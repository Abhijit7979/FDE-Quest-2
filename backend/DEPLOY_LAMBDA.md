# Deploying the backend to AWS Lambda

> **Quick path:** run `./deploy_lambda.sh` from `backend/`. It is idempotent —
> it performs every step below (S3 bucket, IAM roles, build, upload, both
> functions, env vars, API Gateway) and re-running it redeploys after code
> changes. Region is **`ap-south-1`**; CORS allows
> `https://fde-quest-2.vercel.app` and `http://localhost:3000`.

The backend ships as a **zip package** (no Docker) and runs as **two Lambda
functions built from one artifact**:

```
                   ┌─────────────────────────┐
  browser ─HTTPS─▶  │  API Lambda             │   FastAPI via Mangum
 (via API Gateway) │  app.lambda_handlers     │   (API Gateway HTTP API)
                   │      .api_handler        │
                   └───────────┬─────────────┘
                               │ async invoke ("Event")
                               ▼
                   ┌─────────────────────────┐
                   │  Worker Lambda          │   LangGraph pipeline
                   │  app.lambda_handlers     │   (run_generation_job)
                   │      .worker_handler     │
                   └─────────────────────────┘
```

`POST /forms/generate` creates the `generation_jobs` row and async-invokes the
worker. The API request returns a `job_id` immediately; the frontend polls
`GET /forms/generate/{job_id}` exactly as before. The API contract and the
`pending → processing → completed|failed` lifecycle are unchanged.

**Why a zip, not a container image:** the locked dependency tree is ~172 MB
unzipped — under Lambda's 250 MB hard limit — so a plain zip works and no
Docker daemon is needed. The artifact is ~65 MB zipped, which exceeds the
50 MB direct-upload cap, so it is staged through an S3 bucket.

---

## 1. S3 deployment bucket

`sketch-to-form-lambda-<ACCOUNT_ID>` in `ap-south-1` holds the build artifact
(`lambda-build.zip`). `create-function` / `update-function-code` read the code
from S3.

## 2. IAM roles

- **`sketch-to-form-worker-role`** — `AWSLambdaBasicExecutionRole` (CloudWatch
  Logs). No other AWS permissions: it talks only to Supabase and the LLM over
  HTTPS.
- **`sketch-to-form-api-role`** — `AWSLambdaBasicExecutionRole` **plus** an
  inline `invoke-worker` policy granting `lambda:InvokeFunction` on
  `sketch-to-form-worker`.

## 3. Build the zip artifact

```bash
cd backend
uv export --frozen --no-emit-project --no-hashes -o .lambda-build/requirements.txt
uv pip install --target .lambda-build \
  --python-platform x86_64-manylinux_2_34 --python-version 3.12 \
  --only-binary :all: --no-cache -r .lambda-build/requirements.txt
cp -r app .lambda-build/app
( cd .lambda-build && zip -qr ../.lambda-build.zip . )
```

`--python-platform x86_64-manylinux_2_34` cross-installs wheels for Lambda's
runtime (Amazon Linux 2023, glibc 2.34, x86_64) so native extensions
(`pydantic-core`, `pillow`, `tiktoken`, `cryptography`) have the correct ABI —
the build host's macOS/arm64 wheels would not load.

## 4. Create the two functions

Both use runtime `python3.12` and the **same artifact**; they differ only in
the handler.

```bash
# Worker first — the API references it by name.
aws lambda create-function --function-name sketch-to-form-worker \
  --runtime python3.12 \
  --handler app.lambda_handlers.worker_handler \
  --code S3Bucket=sketch-to-form-lambda-<ACCOUNT>,S3Key=lambda-build.zip \
  --role arn:aws:iam::<ACCOUNT>:role/sketch-to-form-worker-role \
  --timeout 600 --memory-size 2048 --region ap-south-1

aws lambda create-function --function-name sketch-to-form-api \
  --runtime python3.12 \
  --handler app.lambda_handlers.api_handler \
  --code S3Bucket=sketch-to-form-lambda-<ACCOUNT>,S3Key=lambda-build.zip \
  --role arn:aws:iam::<ACCOUNT>:role/sketch-to-form-api-role \
  --timeout 30 --memory-size 512 --region ap-south-1
```

Sizing: the worker does vision + LLM calls + one repair loop — `2048` MB /
`600` s is a safe start (hard ceiling 900 s). The API only does light DB calls
— `512` MB / `30` s is plenty.

## 5. Environment variables

Set on **both** functions. There is no `.env` in the artifact — values come
from Lambda env vars (read directly by pydantic-settings via `app/config.py`).

| Variable | Value |
|---|---|
| `JOB_DISPATCH_MODE` | `lambda` |
| `WORKER_FUNCTION_NAME` | `sketch-to-form-worker` |
| `CORS_ORIGINS` | `["https://fde-quest-2.vercel.app","http://localhost:3000"]` |
| `SUPABASE_URL` | project URL |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `SUPABASE_JWT_SECRET` | optional (legacy HS256 only) |
| `SKETCHES_BUCKET` | `sketches` |
| `LLM_PROVIDER` + provider creds | `openai` + `OPENAI_API_KEY` |
| `LOG_LEVEL` | `INFO` |

## 6. Public API Gateway HTTP API

The API Lambda is fronted by an **API Gateway HTTP API** named
`sketch-to-form-http`. It is created with `apigatewayv2 create-api --target
<lambda-arn>`, which wires up a catch-all `$default` route, an `AWS_PROXY`
integration, and an auto-deployed `$default` stage in one call; a
`lambda:InvokeFunction` permission for `apigateway.amazonaws.com` is added
separately. Mangum auto-detects the API Gateway v2 payload format.

> **Why not a Lambda Function URL?** A Function URL with `AuthType=NONE`
> returns `403 AccessDeniedException` on this account even with a correct
> public resource policy — public Function URLs are blocked here. API Gateway
> is unaffected.

AWS-level auth on the HTTP API is open; **JWT auth is still enforced inside the
app** (`app/security.py`). Point the frontend's `NEXT_PUBLIC_API_URL` at the
`ApiEndpoint` the script prints.

---

## Redeploying after code changes

Just run `./deploy_lambda.sh` again — it rebuilds the zip, re-uploads to S3,
and calls `update-function-code` + `update-function-configuration` on both
functions. The S3 bucket, IAM roles, and HTTP API are reused (the API
endpoint URL is stable across redeploys).

## Troubleshooting

- **`Runtime.ImportModuleError` / wrong-ABI `.so`** — the build was not
  cross-installed for `x86_64-manylinux_2_34`. Re-run the script (it always
  rebuilds with the right `--python-platform`).
- **CORS errors in the browser** — confirm the caller's origin is in
  `CORS_ORIGINS` (edit the value in `deploy_lambda.sh` and redeploy).
- **Logs** — `aws logs tail /aws/lambda/sketch-to-form-api --follow --region ap-south-1`
  (or `sketch-to-form-worker`).
