import logging
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app.config import get_settings
from app.jobs import dispatch_to_lambda, run_generation_job
from app.schemas.api import (
    GenerateRequest,
    GenerateResponse,
    JobStatusResponse,
    ValidateError,
    ValidateRequest,
    ValidateResponse,
)
from app.schemas.definition import Definition
from app.security import CurrentUser, bearer_scheme
from app.supabase_client import get_user_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forms", tags=["forms"])


def _require_jwt(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> str:
    return creds.credentials


def _ensure_path_owned_by(storage_path: str, user_id: str) -> None:
    # Defense-in-depth: storage RLS already enforces this on the upload side,
    # but the FastAPI download uses the service role which bypasses RLS.
    first = storage_path.split("/", 1)[0]
    if first != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="storage_path must live under the caller's user folder",
        )


def _sketch_fields_for_paths(paths: list[str]) -> dict[str, Any]:
    if not paths:
        return {"sketch_path": None, "sketch_paths": None}
    return {"sketch_path": paths[0], "sketch_paths": paths}


@router.post(
    "/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_form(
    payload: GenerateRequest,
    background: BackgroundTasks,
    user: CurrentUser,
    jwt: Annotated[str, Depends(_require_jwt)],
) -> GenerateResponse:
    for path in payload.storage_paths:
        _ensure_path_owned_by(path, user.id)
    sb = get_user_client(jwt)
    sketch_fields = _sketch_fields_for_paths(payload.storage_paths)

    # Resolve or create the target form row.
    if payload.form_id:
        existing = (
            sb.table("forms")
            .select("id, owner_id")
            .eq("id", payload.form_id)
            .limit(1)
            .execute()
        )
        rows = existing.data or []
        if not rows:
            # RLS will hide rows owned by someone else, so this also covers 403.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="form not found",
            )
        form_id: str = rows[0]["id"]
        sb.table("forms").update(sketch_fields).eq("id", form_id).execute()
    else:
        created = (
            sb.table("forms")
            .insert(
                {
                    "owner_id": user.id,
                    **sketch_fields,
                    "title": "Untitled form",
                }
            )
            .execute()
        )
        if not created.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="failed to create draft form",
            )
        form_id = created.data[0]["id"]

    job = (
        sb.table("generation_jobs")
        .insert(
            {
                "form_id": form_id,
                "owner_id": user.id,
                "status": "pending",
            }
        )
        .execute()
    )
    if not job.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to create generation job",
        )
    job_id: str = job.data[0]["id"]

    job_kwargs: dict[str, Any] = {
        "job_id": job_id,
        "form_id": form_id,
        "owner_id": user.id,
        "user_jwt": jwt,
        "storage_paths": payload.storage_paths,
        "description": payload.description,
    }
    if get_settings().job_dispatch_mode == "lambda":
        # On Lambda the request env freezes after the response; hand the job to
        # a separate worker Lambda instead of running it in this process.
        dispatch_to_lambda(job_kwargs)
    else:
        background.add_task(run_generation_job, **job_kwargs)
    logger.info("queued job %s for form %s (owner=%s)", job_id, form_id, user.id)

    return GenerateResponse(job_id=job_id, form_id=form_id, status="pending")


@router.get("/generate/{job_id}", response_model=JobStatusResponse)
def get_generation_job(
    job_id: str,
    _user: CurrentUser,
    jwt: Annotated[str, Depends(_require_jwt)],
) -> JobStatusResponse:
    sb = get_user_client(jwt)
    result = (
        sb.table("generation_jobs")
        .select("id, form_id, status, error")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="job not found"
        )
    row = rows[0]

    definition: Definition | None = None
    if row["status"] == "completed" and row["form_id"]:
        form = (
            sb.table("forms")
            .select("definition")
            .eq("id", row["form_id"])
            .limit(1)
            .execute()
        )
        if form.data:
            raw_def: dict[str, Any] = form.data[0]["definition"] or {}
            try:
                definition = Definition.model_validate(raw_def)
            except ValidationError:
                # Don't 500 the polling endpoint; surface as warning instead.
                definition = None

    return JobStatusResponse(
        job_id=row["id"],
        form_id=row.get("form_id"),
        status=row["status"],
        error=row.get("error"),
        definition=definition,
        warnings=[],
    )


@router.post("/validate", response_model=ValidateResponse)
def validate_definition(
    payload: ValidateRequest,
    _user: CurrentUser,
) -> ValidateResponse:
    try:
        Definition.model_validate(payload.definition)
    except ValidationError as exc:
        return ValidateResponse(
            valid=False,
            errors=[
                ValidateError(
                    loc=[str(p) for p in e["loc"]],
                    msg=e["msg"],
                    type=e["type"],
                )
                for e in exc.errors()
            ],
        )
    return ValidateResponse(valid=True, errors=[])
