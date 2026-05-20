from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel

from app.config import Settings, get_settings


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None
    claims: dict[str, Any]


bearer_scheme = HTTPBearer(auto_error=True, description="Supabase JWT")


@lru_cache(maxsize=1)
def _jwks_client(supabase_url: str) -> PyJWKClient:
    url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url, cache_keys=True)


def _decode_supabase_jwt(token: str, settings: Settings) -> dict[str, Any]:
    # Primary path: asymmetric keys (ES256 / RS256) via JWKS
    try:
        signing_key = _jwks_client(settings.supabase_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.InvalidTokenError:
        pass

    # Fallback: legacy HS256 projects only
    if settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

    raise jwt.InvalidTokenError("Token verification failed")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthenticatedUser:
    try:
        claims = _decode_supabase_jwt(credentials.credentials, settings)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(
        id=user_id,
        email=claims.get("email"),
        role=claims.get("role"),
        claims=claims,
    )


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]