from functools import lru_cache
from typing import Literal

from langgraph.graph import END, START, StateGraph

from app.pipeline.nodes.persist import persist
from app.pipeline.nodes.preprocess import preprocess
from app.pipeline.nodes.repair import repair
from app.pipeline.nodes.structure import structure
from app.pipeline.nodes.validate import validate
from app.pipeline.nodes.vision_extract import vision_extract
from app.pipeline.state import PipelineState

MAX_REPAIRS = 1


def _after_validate(state: PipelineState) -> Literal["repair", "persist"]:
    if state.get("validation_error") and state.get("repair_count", 0) < MAX_REPAIRS:
        return "repair"
    return "persist"


@lru_cache(maxsize=1)
def build_graph():
    g: StateGraph = StateGraph(PipelineState)

    g.add_node("preprocess", preprocess)
    g.add_node("vision_extract", vision_extract)
    g.add_node("structure", structure)
    g.add_node("validate", validate)
    g.add_node("repair", repair)
    g.add_node("persist", persist)

    g.add_edge(START, "preprocess")
    g.add_edge("preprocess", "vision_extract")
    g.add_edge("vision_extract", "structure")
    g.add_edge("structure", "validate")

    # validate -> repair (once) -> vision_extract again, else persist
    g.add_conditional_edges("validate", _after_validate, {
        "repair": "repair",
        "persist": "persist",
    })
    g.add_edge("repair", "vision_extract")
    g.add_edge("persist", END)

    return g.compile()
