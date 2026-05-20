import logging

from app.pipeline.state import PipelineState

logger = logging.getLogger(__name__)


def repair(state: PipelineState) -> PipelineState:
    """
    Marker node that increments the repair counter. The actual LLM re-invocation
    happens in vision_extract on the next pass (it reads validation_error from
    state and prepends the REPAIR_INSTRUCTION).
    """
    count = state.get("repair_count", 0) + 1
    logger.info("repair: attempt %s", count)
    return {**state, "repair_count": count}
