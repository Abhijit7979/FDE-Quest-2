# Deploying the backend to AWS Lambda

The backend runs as **two Lambda functions built from one container image**:

```
                   ┌─────────────────────────┐
  browser ─HTTPS─▶  │  API Lambda             │   FastAPI via Mangum
                   │  app.lambda_handlers     │   (Function URL)
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

Why a container image: the langgraph/langchain dependency tree exceeds Lambda's
250 MB zipped limit. Container images allow up to 10 GB.

---

## 1. Build & push the image to ECR

```bash
cd backend
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REPO=sketch-to-form-api

aws ecr create-repository --repository-name $REPO --region $REGION

aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# --platform linux/amd64 is required when building on Apple Silicon.
docker build --platform linux/amd64 -t $REPO .
docker tag $REPO:latest $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest
```

## 2. Create the two functions

Both point at the **same image**; they differ only in the CMD override.

**Worker Lambda** (create this first — the API needs its name):

```bash
aws lambda create-function \
  --function-name sketch-to-form-worker \
  --package-type Image \
  --code ImageUri=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest \
  --image-config '{"Command":["app.lambda_handlers.worker_handler"]}' \
  --role arn:aws:iam::$ACCOUNT:role/sketch-to-form-worker-role \
  --timeout 600 --memory-size 2048 \
  --region $REGION
```

**API Lambda:**

```bash
aws lambda create-function \
  --function-name sketch-to-form-api \
  --package-type Image \
  --code ImageUri=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest \
  --image-config '{"Command":["app.lambda_handlers.api_handler"]}' \
  --role arn:aws:iam::$ACCOUNT:role/sketch-to-form-api-role \
  --timeout 30 --memory-size 512 \
  --region $REGION
```

Sizing notes: the worker does vision + LLM calls + one repair loop — `2048` MB
and `600` s timeout is a safe start (the hard ceiling is 900 s). The API only
does light DB calls — `512` MB / `30` s is plenty.

## 3. IAM

- **`sketch-to-form-worker-role`** — `AWSLambdaBasicExecutionRole` (CloudWatch
  Logs). No other AWS permissions: it talks only to Supabase and the LLM over
  HTTPS.
- **`sketch-to-form-api-role`** — `AWSLambdaBasicExecutionRole` **plus**
  `lambda:InvokeFunction` on the worker:

  ```json
  {
    "Effect": "Allow",
    "Action": "lambda:InvokeFunction",
    "Resource": "arn:aws:lambda:us-east-1:<ACCOUNT>:function:sketch-to-form-worker"
  }
  ```

## 4. Environment variables

Set on **both** functions (`aws lambda update-function-configuration
--environment Variables={...}`). The `.env` file is not in the image — values
come from Lambda env vars (read directly by pydantic-settings).

| Variable | Value |
|---|---|
| `JOB_DISPATCH_MODE` | `lambda` |
| `WORKER_FUNCTION_NAME` | `sketch-to-form-worker` |
| `SUPABASE_URL` | your project URL |
| `SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `SKETCHES_BUCKET` | `sketches` |
| `LLM_PROVIDER` + provider creds | `OPENAI_API_KEY` etc. |
| `CORS_ORIGINS` | `["https://<your-app>.vercel.app"]` |
| `LOG_LEVEL` | `INFO` |

`WORKER_FUNCTION_NAME` is only consumed by the API Lambda, but setting it on
both is harmless. For production, store the secrets in **AWS Secrets Manager**
and reference them rather than pasting plaintext.

## 5. Public URL for the API

Create a **Lambda Function URL** on `sketch-to-form-api` (simplest — no API
Gateway needed):

```bash
aws lambda create-function-url-config \
  --function-name sketch-to-form-api \
  --auth-type NONE --region $REGION

aws lambda add-permission \
  --function-name sketch-to-form-api \
  --statement-id public-url --action lambda:InvokeFunctionUrl \
  --principal "*" --function-url-auth-type NONE --region $REGION
```

The returned URL serves all routes under `/api/v1/...`. Auth is still enforced
inside the app by the JWT bearer check — `auth-type NONE` only means AWS itself
does not gate the URL.

## 6. Wire up the frontend

Point the frontend at the Function URL (whatever env var it uses for the API
base, e.g. `NEXT_PUBLIC_API_BASE_URL`) and redeploy on Vercel. Make sure that
Vercel origin is in `CORS_ORIGINS`.

## Redeploying after code changes

```bash
docker build --platform linux/amd64 -t $REPO . && \
docker tag $REPO:latest $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest && \
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest && \
aws lambda update-function-code --function-name sketch-to-form-api \
  --image-uri $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest --region $REGION && \
aws lambda update-function-code --function-name sketch-to-form-worker \
  --image-uri $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest --region $REGION
```

## Things to know

- **Cold starts** — heavy imports make the first request after idle slow
  (several seconds). The generate flow is async so it tolerates this; for the
  synchronous `/me` and `/forms/validate` routes, add provisioned concurrency
  if the latency matters.
- **Retries** — async invoke retries twice on an *unhandled* crash (OOM /
  timeout). `run_generation_job` catches pipeline errors itself and records
  `failed`, so those do **not** retry. A genuine crash will redeliver; the
  idempotency guard in `run_generation_job` skips a job already `completed`.
  Attach a dead-letter queue to the worker to capture exhausted retries.
- **15-minute ceiling** — the worker must finish within Lambda's max timeout.
- **JWT lifetime** — the caller's JWT is forwarded to the worker and used for
  RLS-scoped DB writes. Supabase access tokens last ~1 h, well beyond a normal
  pipeline run, but a job delayed by long retry backoff could outlive it.

## Local development

Unchanged. `JOB_DISPATCH_MODE` defaults to `background`, so
`uv run uvicorn app.main:app --reload` runs the pipeline in-process via
FastAPI BackgroundTasks — no AWS, no Docker needed.
