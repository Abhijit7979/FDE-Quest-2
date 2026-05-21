from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.definition import Definition

JobStatus = Literal["pending", "processing", "completed", "failed"]

MAX_SKETCH_PATHS = 5


class GenerateRequest(BaseModel):
    """Start async sketch-to-form generation."""

    storage_path: str | None = Field(
        default=None,
        min_length=1,
        description="Legacy single-path field; prefer storage_paths.",
    )
    storage_paths: list[str] = Field(default_factory=list)
    description: str | None = Field(default=None, max_length=8000)
    form_id: str | None = None

    @model_validator(mode="after")
    def _normalize_inputs(self) -> "GenerateRequest":
        paths: list[str] = []
        if self.storage_path:
            paths.append(self.storage_path)
        for p in self.storage_paths:
            p = p.strip()
            if p and p not in paths:
                paths.append(p)

        desc = (self.description or "").strip() or None
        if len(paths) > MAX_SKETCH_PATHS:
            raise ValueError(f"At most {MAX_SKETCH_PATHS} sketch images per request")
        if not paths and not desc:
            raise ValueError(
                "Provide at least one sketch image path or a text description"
            )

        object.__setattr__(self, "storage_paths", paths)
        object.__setattr__(self, "storage_path", paths[0] if paths else None)
        object.__setattr__(self, "description", desc)
        return self


class GenerateResponse(BaseModel):
    job_id: str
    form_id: str
    status: JobStatus


class JobStatusResponse(BaseModel):
    job_id: str
    form_id: str | None
    status: JobStatus
    error: str | None = None
    definition: Definition | None = None
    warnings: list[str] = Field(default_factory=list)


class ValidateRequest(BaseModel):
    definition: dict


class ValidateError(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidateError] = Field(default_factory=list)
