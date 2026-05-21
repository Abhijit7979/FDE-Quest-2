# Lambda container image for the Sketch-to-Form backend.
#
# The langgraph/langchain dependency tree exceeds Lambda's 250 MB zip limit,
# so the backend ships as a container image (up to 10 GB).
#
# One image serves BOTH Lambda functions — each function overrides the CMD:
#   API Lambda     app.lambda_handlers.api_handler   (default CMD below)
#   Worker Lambda  app.lambda_handlers.worker_handler
#
# Build on Apple Silicon for an x86_64 Lambda:
#   docker build --platform linux/amd64 -t sketch-to-form-api .
# See DEPLOY_LAMBDA.md for the ECR push + function setup.

FROM public.ecr.aws/lambda/python:3.12

# uv: fast, reproducible installs straight from uv.lock.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR ${LAMBDA_TASK_ROOT}

# Install locked dependencies into the image's system Python. Done before
# copying app code so the layer is cached across code-only changes.
COPY pyproject.toml uv.lock ./
RUN uv export --frozen --no-emit-project --no-hashes -o requirements.txt \
 && uv pip install --system --no-cache -r requirements.txt \
 && rm requirements.txt

# Application code.
COPY app ./app

# Default to the API handler; the worker Lambda overrides this CMD.
CMD ["app.lambda_handlers.api_handler"]
