import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.observability import (
    flush as flush_langfuse,
    get_langchain_callback_handler,
    get_langfuse_client,
    trace_root,
)
from app.pipeline.graph import build_graph
from app.pipeline.state import PipelineState
from app.supabase_client import get_user_client

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


@lru_cache(maxsize=1)
def _lambda_client() -> Any:
    # Imported lazily so "background" dispatch mode never needs boto3 loaded.
    import boto3

    return boto3.client("lambda")


def dispatch_to_lambda(job_kwargs: dict[str, Any]) -> None:
    """
    Async-invoke ('Event') the worker Lambda to run the pipeline out-of-band.
    This is the Lambda equivalent of BackgroundTasks.add_task: the API request
    returns immediately and the worker runs in its own execution environment.
    """
    settings = get_settings()
    if not settings.worker_function_name:
        raise RuntimeError(
            "WORKER_FUNCTION_NAME must be set when JOB_DISPATCH_MODE=lambda"
        )
    _lambda_client().invoke(
        FunctionName=settings.worker_function_name,
        InvocationType="Event",
        Payload=json.dumps(job_kwargs).encode("utf-8"),
    )


def run_generation_job(
    *,
    job_id: str,
    form_id: str,
    owner_id: str,
    user_jwt: str,
    storage_paths: list[str],
    description: str | None = None,
) -> None:
    """
    Job entrypoint (FastAPI BackgroundTasks or the worker Lambda). Updates
    generation_jobs through the lifecycle, invokes the LangGraph pipeline,
    swallows exceptions into the 'failed' state.
    """
    sb = get_user_client(user_jwt)

    # Idempotency: an async Lambda invoke (or SQS) can redeliver this job after
    # a hard crash/timeout. Don't reprocess one that already finished.
    current = (
        sb.table("generation_jobs")
        .select("status")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    rows = current.data or []
    if rows and rows[0]["status"] == "completed":
        logger.info("job %s already completed; skipping redelivery", job_id)
        return

    sb.table("generation_jobs").update({"status": "processing"}).eq("id", job_id).execute()

    state: PipelineState = {
        "job_id": job_id,
        "form_id": form_id,
        "owner_id": owner_id,
        "user_jwt": user_jwt,
        "storage_paths": storage_paths,
        "storage_path": storage_paths[0] if storage_paths else None,
        "description": description,
        "warnings": [],
        "repair_count": 0,
    }

    settings = get_settings()
    lf_client = get_langfuse_client()
    lc_handler = get_langchain_callback_handler()

    invoke_config: dict[str, Any] | None = None
    if lc_handler is not None:
        invoke_config = {"callbacks": [lc_handler]}

    # Trace input intentionally omits user_jwt (sensitive).
    trace_input = {
        "job_id": job_id,
        "form_id": form_id,
        "owner_id": owner_id,
        "storage_paths": storage_paths,
        "description": description,
    }

    vision_model = (
        settings.openai_vision_model
        if settings.llm_provider == "openai"
        else settings.github_model
    )

    try:
        graph = build_graph()
        # session_id=form_id groups every generation+repair attempt for the
        # same form under one session in the Langfuse UI.
        with trace_root(
            "sketch-to-form-job",
            user_id=owner_id,
            session_id=form_id,
            tags=["sketch-to-form", settings.llm_provider],
            metadata={
                "job_id": job_id,
                "dispatch_mode": settings.job_dispatch_mode,
                "llm_provider": settings.llm_provider,
                "vision_model": vision_model,
                "sketch_count": len(storage_paths),
            },
            input=trace_input,
        ) as span:
            final = graph.invoke(state, config=invoke_config) if invoke_config else graph.invoke(state)

            if span is not None:
                fields = final.get("definition", {}).get("fields", [])
                span.update(
                    output={
                        "field_count": len(fields),
                        "warnings": final.get("warnings", []),
                        "repair_count": final.get("repair_count", 0),
                        "validation_error": final.get("validation_error"),
                    }
                )

        sb.table("generation_jobs").update(
            {"status": "completed", "completed_at": _now(), "error": None}
        ).eq("id", job_id).execute()
        logger.info(
            "job %s completed (form=%s, warnings=%s)",
            job_id,
            form_id,
            len(final.get("warnings", [])),
        )
    except Exception as exc:  # noqa: BLE001 — we want to capture anything
        logger.exception("job %s failed", job_id)
        sb.table("generation_jobs").update(
            {
                "status": "failed",
                "completed_at": _now(),
                "error": f"{type(exc).__name__}: {exc}"[:1000],
            }
        ).eq("id", job_id).execute()
    finally:
        # Background tasks and Lambda freeze quickly after returning — flush
        # so the trace isn't dropped.
        if lf_client is not None:
            flush_langfuse()
