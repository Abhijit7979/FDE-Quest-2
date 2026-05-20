from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache(maxsize=1)
def get_service_client() -> Client:
    """
    Service-role client. Bypasses RLS — use only for Storage reads from
    the private 'sketches' bucket (no read policy exists for the backend).
    """
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is required for backend Storage reads"
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_client(jwt: str) -> Client:
    """
    Per-request Supabase client that authenticates as the calling user via
    PostgREST's auth(jwt) so RLS sees auth.uid() = user.id. All forms /
    generation_jobs writes go through this client.
    """
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(jwt)
    return client
