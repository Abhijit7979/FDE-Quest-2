from typing import Any, TypedDict


class ProcessedImage(TypedDict):
    bytes: bytes
    mime: str


class PipelineState(TypedDict, total=False):
    """
    State passed between LangGraph nodes for a single sketch-to-form run.
    Optional keys are populated progressively as nodes execute.
    """

    # Inputs (set before invoke)
    job_id: str
    form_id: str
    owner_id: str
    user_jwt: str
    storage_path: str | None
    storage_paths: list[str]
    description: str | None

    # preprocess
    images: list[ProcessedImage]
    image_bytes: bytes
    image_mime: str

    # vision_extract — raw model output (string) before parse
    raw_extraction: str

    # structure/validate
    definition: dict[str, Any]
    validation_error: str | None
    repair_count: int

    # output
    warnings: list[str]
