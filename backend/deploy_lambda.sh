#!/usr/bin/env bash
#
# Deploy the Sketch-to-Form backend to AWS Lambda.
#
# One container image, two Lambda functions (API + worker), an ECR repo,
# two IAM roles, and a public Function URL for the API. See DEPLOY_LAMBDA.md
# for the architecture.
#
# This script is IDEMPOTENT — run it once to deploy, run it again to redeploy
# after code changes (it rebuilds the image and updates both functions).
#
# Prerequisites:
#   - Docker daemon running          (open -a Docker)
#   - AWS CLI authenticated          (aws sts get-caller-identity)
#   - backend/.env populated         (Supabase + LLM keys)
#
# Usage:
#   cd backend && ./deploy_lambda.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REGION="ap-south-1"
REPO="sketch-to-form-api"
API_FN="sketch-to-form-api"
WORKER_FN="sketch-to-form-worker"
API_ROLE="sketch-to-form-api-role"
WORKER_ROLE="sketch-to-form-worker-role"

# Origins allowed to call the API from a browser (handled by the app's
# CORSMiddleware). No trailing slash — browsers send Origin without one.
CORS_ORIGINS='["https://fde-quest-2.vercel.app","http://localhost:3000"]'

# Sizing (see DEPLOY_LAMBDA.md §2).
API_TIMEOUT=30
API_MEMORY=512
WORKER_TIMEOUT=600
WORKER_MEMORY=2048

cd "$(dirname "$0")"
ENV_FILE=".env"

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
echo "==> Preflight checks"
command -v aws    >/dev/null || { echo "ERROR: aws CLI not found"; exit 1; }
command -v docker >/dev/null || { echo "ERROR: docker not found"; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found"; exit 1; }
docker info >/dev/null 2>&1 || { echo "ERROR: Docker daemon not running — run 'open -a Docker'"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found"; exit 1; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ECR_URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO}"
IMAGE="${ECR_URI}:latest"
echo "    account=${ACCOUNT} region=${REGION}"

# ---------------------------------------------------------------------------
# 1. ECR repository
# ---------------------------------------------------------------------------
echo "==> [1/7] ECR repository"
if aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1; then
  echo "    repo '$REPO' already exists"
else
  aws ecr create-repository --repository-name "$REPO" --region "$REGION" \
    --image-scanning-configuration scanOnPush=true >/dev/null
  echo "    created repo '$REPO'"
fi

# ---------------------------------------------------------------------------
# 2. IAM roles
# ---------------------------------------------------------------------------
echo "==> [2/7] IAM roles"

TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

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

ROLE_CREATED=0
ensure_role "$WORKER_ROLE"
ensure_role "$API_ROLE"

# The API role must be allowed to async-invoke the worker.
INVOKE_POLICY=$(cat <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"lambda:InvokeFunction","Resource":"arn:aws:lambda:${REGION}:${ACCOUNT}:function:${WORKER_FN}"}]}
EOF
)
aws iam put-role-policy --role-name "$API_ROLE" \
  --policy-name invoke-worker --policy-document "$INVOKE_POLICY"
echo "    attached invoke-worker policy to '$API_ROLE'"

API_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${API_ROLE}"
WORKER_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${WORKER_ROLE}"

# IAM is eventually consistent — a freshly created role can't be assumed by
# Lambda for a few seconds.
if [ "$ROLE_CREATED" = "1" ]; then
  echo "    waiting 12s for IAM propagation..."
  sleep 12
fi

# ---------------------------------------------------------------------------
# 3. Build & push the container image
# ---------------------------------------------------------------------------
echo "==> [3/7] Build & push image to ECR"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

# --platform linux/amd64 is required when building on Apple Silicon.
docker build --platform linux/amd64 -t "${REPO}:latest" .
docker tag "${REPO}:latest" "$IMAGE"
docker push "$IMAGE"
echo "    pushed ${IMAGE}"

# ---------------------------------------------------------------------------
# 4. Environment variables
# ---------------------------------------------------------------------------
echo "==> [4/7] Build environment variable payloads"

# Reads backend/.env, applies the Lambda-specific overrides, and emits the
# AWS-shaped {"Variables":{...}} JSON. Only the keys the app actually reads
# are forwarded; CORS / dispatch values are overridden for the cloud.
build_env_json() {
  local out_file="$1"
  CORS_ORIGINS="$CORS_ORIGINS" WORKER_FN="$WORKER_FN" python3 - "$ENV_FILE" "$out_file" <<'PY'
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

print(f"    {len(vars_)} variables -> {out_path}")
PY
}

ENV_JSON="$(mktemp -t lambda-env-XXXX.json)"
trap 'rm -f "$ENV_JSON"' EXIT
build_env_json "$ENV_JSON"

# ---------------------------------------------------------------------------
# 5. Lambda functions (create or update)
# ---------------------------------------------------------------------------
echo "==> [5/7] Lambda functions"

# deploy_fn <name> <role-arn> <handler> <timeout> <memory>
deploy_fn() {
  local name="$1" role_arn="$2" handler="$3" timeout="$4" memory="$5"

  if aws lambda get-function --function-name "$name" --region "$REGION" >/dev/null 2>&1; then
    echo "    [$name] exists — updating code"
    aws lambda update-function-code --function-name "$name" \
      --image-uri "$IMAGE" --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$name" --region "$REGION"

    echo "    [$name] updating configuration"
    aws lambda update-function-configuration --function-name "$name" \
      --timeout "$timeout" --memory-size "$memory" \
      --environment "file://${ENV_JSON}" --region "$REGION" >/dev/null
    aws lambda wait function-updated --function-name "$name" --region "$REGION"
  else
    echo "    [$name] creating"
    aws lambda create-function --function-name "$name" \
      --package-type Image \
      --code "ImageUri=${IMAGE}" \
      --image-config "{\"Command\":[\"${handler}\"]}" \
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
# 6. Public Function URL for the API
# ---------------------------------------------------------------------------
echo "==> [6/7] API Function URL"
if aws lambda get-function-url-config --function-name "$API_FN" --region "$REGION" >/dev/null 2>&1; then
  echo "    Function URL already configured"
else
  aws lambda create-function-url-config --function-name "$API_FN" \
    --auth-type NONE --region "$REGION" >/dev/null
  # Allow unauthenticated (AWS-level) invocation of the URL. JWT auth is still
  # enforced inside the app.
  aws lambda add-permission --function-name "$API_FN" \
    --statement-id public-url --action lambda:InvokeFunctionUrl \
    --principal "*" --function-url-auth-type NONE --region "$REGION" >/dev/null
  echo "    Function URL created"
fi

FUNCTION_URL="$(aws lambda get-function-url-config --function-name "$API_FN" \
  --region "$REGION" --query FunctionUrl --output text)"

# ---------------------------------------------------------------------------
# 7. Done
# ---------------------------------------------------------------------------
echo "==> [7/7] Deployment complete"
echo
echo "  API base URL : ${FUNCTION_URL}"
echo "  Health check : ${FUNCTION_URL%/}/api/v1/health"
echo
echo "  Next steps:"
echo "    1. Test:   curl ${FUNCTION_URL%/}/api/v1/health"
echo "    2. Set the frontend's API base env var to the URL above and redeploy."
echo "    3. Confirm https://fde-quest-2.vercel.app is in CORS_ORIGINS (it is)."
