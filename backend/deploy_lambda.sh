#!/usr/bin/env bash
#
# Deploy the Sketch-to-Form backend to AWS Lambda — ZIP package, no Docker.
#
# One zip artifact, two Lambda functions (API + worker), an S3 bucket for the
# artifact, two IAM roles, and a public API Gateway HTTP API for the API.
#
#                    ┌─────────────────────────┐
#   browser ─HTTPS─▶  │  API Lambda             │   FastAPI via Mangum
#  (via API Gateway) │  app.lambda_handlers     │   (API Gateway HTTP API)
#                    │      .api_handler        │
#                    └───────────┬─────────────┘
#                                │ async invoke ("Event")
#                                ▼
#                    ┌─────────────────────────┐
#                    │  Worker Lambda          │   LangGraph pipeline
#                    │  app.lambda_handlers     │   (run_generation_job)
#                    │      .worker_handler     │
#                    └─────────────────────────┘
#
# Why a zip instead of a container image: the locked dependency tree is
# ~172 MB unzipped — under Lambda's 250 MB hard limit — so a plain zip works
# and no Docker daemon is needed. The artifact is ~65 MB zipped, which exceeds
# the 50 MB direct-upload cap, so it is staged through S3.
#
# This script is IDEMPOTENT — run it once to deploy, run it again to redeploy
# after code changes (it rebuilds the zip and updates both functions).
#
# Prerequisites:
#   - AWS CLI authenticated      (aws sts get-caller-identity)
#   - uv installed               (https://docs.astral.sh/uv/)
#   - backend/.env populated     (Supabase + LLM keys)
#
# Usage:
#   cd backend && ./deploy_lambda.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REGION="ap-south-1"
API_FN="sketch-to-form-api"
WORKER_FN="sketch-to-form-worker"
API_ROLE="sketch-to-form-api-role"
WORKER_ROLE="sketch-to-form-worker-role"
RUNTIME="python3.12"

# Lambda runs Amazon Linux 2023 (glibc 2.34) on x86_64 — cross-install wheels
# for that target so native extensions (pydantic-core, pillow, tiktoken …) are
# the correct ABI.
LAMBDA_PLATFORM="x86_64-manylinux_2_34"
PYTHON_VERSION="3.12"

# Origins allowed to call the API from a browser (the app's CORSMiddleware
# reads CORS_ORIGINS). No trailing slash — browsers send Origin without one.
CORS_ORIGINS='["https://fde-quest-2.vercel.app","http://localhost:3000"]'

# Sizing: the worker does vision + LLM calls + one repair loop; the API only
# does light DB calls. 900 s is the Lambda hard ceiling.
API_TIMEOUT=30
API_MEMORY=512
WORKER_TIMEOUT=600
WORKER_MEMORY=2048

cd "$(dirname "$0")"
ENV_FILE=".env"
BUILD_DIR=".lambda-build"
ZIP_FILE=".lambda-build.zip"

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
echo "==> Preflight checks"
command -v aws    >/dev/null || { echo "ERROR: aws CLI not found"; exit 1; }
command -v uv     >/dev/null || { echo "ERROR: uv not found"; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found"; exit 1; }
command -v zip    >/dev/null || { echo "ERROR: zip not found"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found"; exit 1; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
DEPLOY_BUCKET="sketch-to-form-lambda-${ACCOUNT}"
S3_KEY="lambda-build.zip"
echo "    account=${ACCOUNT} region=${REGION}"

# ---------------------------------------------------------------------------
# 1. S3 deployment bucket
# ---------------------------------------------------------------------------
echo "==> [1/7] S3 deployment bucket"
if aws s3api head-bucket --bucket "$DEPLOY_BUCKET" --region "$REGION" >/dev/null 2>&1; then
  echo "    bucket '$DEPLOY_BUCKET' already exists"
else
  aws s3api create-bucket --bucket "$DEPLOY_BUCKET" --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  echo "    created bucket '$DEPLOY_BUCKET'"
fi

# ---------------------------------------------------------------------------
# 2. IAM roles
# ---------------------------------------------------------------------------
echo "==> [2/7] IAM roles"

TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

ROLE_CREATED=0
ensure_role() {
  local role="$1"
  if aws iam get-role --role-name "$role" >/dev/null 2>&1; then
    echo "    role '$role' already exists"
  else
    aws iam create-role --role-name "$role" \
      --assume-role-policy-document "$TRUST_POLICY" >/dev/null
    aws iam attach-role-policy --role-name "$role" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    echo "    created role '$role'"
    ROLE_CREATED=1
  fi
}

ensure_role "$WORKER_ROLE"
ensure_role "$API_ROLE"

# The API role must be allowed to async-invoke the worker.
INVOKE_POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:${REGION}:${ACCOUNT}:function:${WORKER_FN}\"}]}"
aws iam put-role-policy --role-name "$API_ROLE" \
  --policy-name invoke-worker --policy-document "$INVOKE_POLICY"
echo "    attached invoke-worker policy to '$API_ROLE'"

API_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${API_ROLE}"
WORKER_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${WORKER_ROLE}"

# IAM is eventually consistent — a freshly created role cannot be assumed by
# Lambda for a few seconds.
if [ "$ROLE_CREATED" = "1" ]; then
  echo "    waiting 12s for IAM propagation..."
  sleep 12
fi

# ---------------------------------------------------------------------------
# 3. Build the zip artifact
# ---------------------------------------------------------------------------
echo "==> [3/7] Build zip artifact"
rm -rf "$BUILD_DIR" "$ZIP_FILE"
mkdir -p "$BUILD_DIR"

# Locked dependencies, cross-installed for the Lambda runtime's platform.
uv export --frozen --no-emit-project --no-hashes -o "${BUILD_DIR}/requirements.txt"
uv pip install \
  --target "$BUILD_DIR" \
  --python-platform "$LAMBDA_PLATFORM" \
  --python-version "$PYTHON_VERSION" \
  --only-binary :all: \
  --no-cache \
  -r "${BUILD_DIR}/requirements.txt"
rm "${BUILD_DIR}/requirements.txt"

# Application code at the zip root, next to its dependencies.
cp -r app "${BUILD_DIR}/app"

# Trim bytes that Lambda never needs.
find "$BUILD_DIR" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete

( cd "$BUILD_DIR" && zip -qr "../${ZIP_FILE}" . )
echo "    artifact: ${ZIP_FILE} ($(du -h "$ZIP_FILE" | cut -f1)), unpacked $(du -sh "$BUILD_DIR" | cut -f1)"

# ---------------------------------------------------------------------------
# 4. Upload the artifact to S3
# ---------------------------------------------------------------------------
echo "==> [4/7] Upload artifact to S3"
aws s3 cp "$ZIP_FILE" "s3://${DEPLOY_BUCKET}/${S3_KEY}" --region "$REGION" >/dev/null
echo "    uploaded s3://${DEPLOY_BUCKET}/${S3_KEY}"

# ---------------------------------------------------------------------------
# 5. Environment variables
# ---------------------------------------------------------------------------
echo "==> [5/7] Build environment variable payload"

# Reads backend/.env, keeps only the keys app/config.py reads, applies the
# Lambda-specific overrides, and emits the AWS-shaped {"Variables":{...}} JSON.
ENV_JSON="$(mktemp -t lambda-env-XXXX.json)"
trap 'rm -f "$ENV_JSON"' EXIT
CORS_ORIGINS="$CORS_ORIGINS" WORKER_FN="$WORKER_FN" python3 - "$ENV_FILE" "$ENV_JSON" <<'PY'
import json, os, sys

env_path, out_path = sys.argv[1], sys.argv[2]

# Only these keys are read by app/config.py — forward exactly this set.
ALLOWED = {
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET", "SKETCHES_BUCKET",
    "LLM_PROVIDER", "OPENAI_API_KEY", "OPENAI_VISION_MODEL",
    "GITHUB_TOKEN", "GITHUB_MODELS_ENDPOINT", "GITHUB_MODEL",
    "LOG_LEVEL",
}

vars_ = {}
with open(env_path) as fh:
    for line in fh:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip()
        if key in ALLOWED and val:
            vars_[key] = val

# Cloud overrides — never taken from the local .env.
vars_["CORS_ORIGINS"] = os.environ["CORS_ORIGINS"]
vars_["JOB_DISPATCH_MODE"] = "lambda"
vars_["WORKER_FUNCTION_NAME"] = os.environ["WORKER_FN"]
vars_.setdefault("LOG_LEVEL", "INFO")
vars_.setdefault("SKETCHES_BUCKET", "sketches")

with open(out_path, "w") as fh:
    json.dump({"Variables": vars_}, fh)

print(f"    {len(vars_)} variables")
PY

# ---------------------------------------------------------------------------
# 6. Lambda functions (create or update)
# ---------------------------------------------------------------------------
echo "==> [6/7] Lambda functions"

# deploy_fn <name> <role-arn> <handler> <timeout> <memory>
deploy_fn() {
  local name="$1" role_arn="$2" handler="$3" timeout="$4" memory="$5"

  if aws lambda get-function --function-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "    [$name] exists — updating code"
    aws lambda update-function-code --function-name "$name" \
      --s3-bucket "$DEPLOY_BUCKET" --s3-key "$S3_KEY" --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$name" --region "$REGION"

    echo "    [$name] updating configuration"
    aws lambda update-function-configuration --function-name "$name" \
      --handler "$handler" --runtime "$RUNTIME" \
      --timeout "$timeout" --memory-size "$memory" \
      --environment "file://${ENV_JSON}" --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$name" --region "$REGION"
  else
    echo "    [$name] creating"
    aws lambda create-function --function-name "$name" \
      --runtime "$RUNTIME" \
      --handler "$handler" \
      --code "S3Bucket=${DEPLOY_BUCKET},S3Key=${S3_KEY}" \
      --role "$role_arn" \
      --timeout "$timeout" --memory-size "$memory" \
      --environment "file://${ENV_JSON}" \
      --region "$REGION" >/dev/null
    aws lambda wait function-active --function-name "$name" --region "$REGION"
  fi
  echo "    [$name] ready"
}

# Worker first — the API's env already references it by name.
deploy_fn "$WORKER_FN" "$WORKER_ROLE_ARN" "app.lambda_handlers.worker_handler" \
  "$WORKER_TIMEOUT" "$WORKER_MEMORY"
deploy_fn "$API_FN" "$API_ROLE_ARN" "app.lambda_handlers.api_handler" \
  "$API_TIMEOUT" "$API_MEMORY"

# ---------------------------------------------------------------------------
# 7. API Gateway HTTP API for the API Lambda
# ---------------------------------------------------------------------------
# A public HTTP API fronts the API Lambda. (Lambda Function URLs with
# AuthType=NONE are blocked on this account, so API Gateway is used instead.)
# JWT auth is still enforced inside the app (app/security.py).
echo "==> [7/7] API Gateway HTTP API"
API_NAME="sketch-to-form-http"

API_ID="$(aws apigatewayv2 get-apis --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text)"

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  # --target wires up a catch-all $default route, an AWS_PROXY integration,
  # and an auto-deployed $default stage in one call.
  API_ID="$(aws apigatewayv2 create-api --region "$REGION" \
    --name "$API_NAME" --protocol-type HTTP \
    --target "arn:aws:lambda:${REGION}:${ACCOUNT}:function:${API_FN}" \
    --query ApiId --output text)"
  echo "    created HTTP API '$API_ID'"
else
  echo "    HTTP API '$API_ID' already exists"
fi

# Allow API Gateway to invoke the API Lambda (idempotent — ignore if present).
aws lambda add-permission --region "$REGION" \
  --function-name "$API_FN" --statement-id apigw-invoke \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*" \
  >/dev/null 2>&1 || echo "    invoke permission already present"

FUNCTION_URL="$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" \
  --query ApiEndpoint --output text)"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo
echo "==> Deployment complete"
echo
echo "  API base URL : ${FUNCTION_URL}"
echo "  Health check : ${FUNCTION_URL%/}/api/v1/health"
echo
echo "  Next steps:"
echo "    1. Test:   curl ${FUNCTION_URL%/}/api/v1/health"
echo "    2. Set the frontend's NEXT_PUBLIC_API_URL to the URL above and redeploy."
