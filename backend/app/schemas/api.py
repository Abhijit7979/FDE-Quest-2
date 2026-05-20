from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.definition import Definition

JobStatus = Literal["pending", "processing", "completed", "failed"]


class GenerateRequest(BaseModel):
    storage_path: str = Field(min_length=1)
    form_id: str | None = None


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
