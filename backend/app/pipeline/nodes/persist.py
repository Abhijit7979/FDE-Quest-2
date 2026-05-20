import logging

from app.pipeline.state import PipelineState
from app.supabase_client import get_user_client

logger = logging.getLogger(__name__)


def persist(state: PipelineState) -> PipelineState:
    """
    Write the generated definition into the existing forms row.
    Uses the caller's JWT so RLS enforces owner_id = auth.uid().
    """
    sb = get_user_client(state["user_jwt"])
    form_id = state["form_id"]
    definition = state["definition"]
    warnings = state.get("warnings", [])

    if state.get("validation_error"):
        # Validation never recovered — still persist so the editor can show
        # whatever partial structure we have, but flag a warning.
        warnings = [*warnings, "definition did not pass strict validation; review required"]

    sb.table("forms").update({"definition": definition}).eq("id", form_id).execute()
    logger.info("persist: form_id=%s fields=%s", form_id, len(definition.get("fields", [])))

    return {**state, "warnings": warnings}
