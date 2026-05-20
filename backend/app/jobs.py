import logging
from datetime import datetime, timezone

from app.pipeline.graph import build_graph
from app.pipeline.state import PipelineState
from app.supabase_client import get_user_client

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def run_generation_job(
    *,
    job_id: str,
    form_id: str,
    owner_id: str,
    user_jwt: str,
    storage_path: str,
) -> None:
    """
    BackgroundTasks entrypoint. Updates generation_jobs through the lifecycle,
    invokes the LangGraph pipeline, swallows exceptions into the 'failed' state.
    """
    sb = get_user_client(user_jwt)

    sb.table("generation_jobs").update({"status": "processing"}).eq("id", job_id).execute()

    state: PipelineState = {
        "job_id": job_id,
        "form_id": form_id,
        "owner_id": owner_id,
        "user_jwt": user_jwt,
        "storage_path": storage_path,
        "warnings": [],
        "repair_count": 0,
    }

    try:
        graph = build_graph()
        final = graph.invoke(state)
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
