from fastapi import APIRouter
from pydantic import BaseModel

from app.security import CurrentUser

router = APIRouter(tags=["auth"])


class MeResponse(BaseModel):
    id: str
    email: str | None
    role: str | None


@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser) -> MeResponse:
    return MeResponse(id=user.id, email=user.email, role=user.role)
