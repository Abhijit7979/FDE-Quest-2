"""
AWS Lambda entrypoints. One container image serves both functions — each
Lambda just overrides the image CMD to pick its handler:

  API Lambda     CMD ["app.lambda_handlers.api_handler"]
  Worker Lambda  CMD ["app.lambda_handlers.worker_handler"]

The API Lambda serves the FastAPI app (via Mangum) behind a Lambda Function
URL or API Gateway. The worker Lambda runs the LangGraph pipeline; it is
async-invoked by the API Lambda's POST /forms/generate route.
"""

import json
import logging
from typing import Any

from mangum import Mangum

from app.config import get_settings
from app.jobs import run_generation_job
from app.main import app

# The FastAPI lifespan (which configures logging) is skipped under Lambda, so
# configure logging here at import time instead.
logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger(__name__)


# --- API Lambda -------------------------------------------------------------
# lifespan="off": Lambda has no startup/shutdown phase to hook; logging is
# already configured above and the app holds no other lifespan state.
api_handler = Mangum(app, lifespan="off")


# --- Worker Lambda ----------------------------------------------------------
def _run_one(record: dict[str, Any]) -> None:
    run_generation_job(
        job_id=record["job_id"],
        form_id=record["form_id"],
        owner_id=record["owner_id"],
        user_jwt=record["user_jwt"],
        storage_paths=record["storage_paths"],
        description=record.get("description"),
    )


def worker_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Worker Lambda entrypoint. Accepts either a direct async-invoke payload
    (the job kwargs dict, as sent by `dispatch_to_lambda`) or an SQS-style
    envelope (`{"Records": [{"body": "<json>"}]}`), so the function still
    works unchanged if a queue is later put in front of it.
    """
    records = event.get("Records")
    if records:  # SQS / queue envelope
        for rec in records:
            _run_one(json.loads(rec["body"]))
    else:  # direct async invoke
        _run_one(event)
    return {"ok": True}
