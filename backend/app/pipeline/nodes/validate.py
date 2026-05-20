import logging

from pydantic import ValidationError

from app.pipeline.state import PipelineState
from app.schemas.definition import Definition

logger = logging.getLogger(__name__)


def validate(state: PipelineState) -> PipelineState:
    try:
        model = Definition.model_validate(state["definition"])
    except ValidationError as exc:
        msg = exc.json(indent=None)
        logger.info("validate: failed (repair_count=%s)", state.get("repair_count", 0))
        return {**state, "validation_error": msg}

    # Round-trip back to dict so downstream nodes work with the normalized shape.
    return {
        **state,
        "definition": model.model_dump(mode="json"),
        "validation_error": None,
    }
