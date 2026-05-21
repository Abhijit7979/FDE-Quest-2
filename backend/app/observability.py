"""
Langfuse tracing wiring.

If LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are unset the helpers no-op and
the rest of the app runs unchanged — no exceptions, no log noise per call.
"""

import logging
from contextlib import contextmanager
from functools import lru_cache
from typing import Any, Iterator

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_langfuse_client():
    """Singleton Langfuse client, or None when keys are not configured."""
    settings = get_settings()
    if not (settings.langfuse_public_key and settings.langfuse_secret_key):
        return None
    try:
        from langfuse import Langfuse

        client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
        logger.info("langfuse: client initialized (host=%s)", settings.langfuse_host)
        return client
    except Exception:  # noqa: BLE001 — tracing must never break the app
        logger.exception("langfuse: client init failed; tracing disabled")
        return None


@lru_cache(maxsize=1)
def get_langchain_callback_handler():
    """LangChain callback handler that nests under the active Langfuse span."""
    if get_langfuse_client() is None:
        return None
    try:
        from langfuse.langchain import CallbackHandler

        return CallbackHandler()
    except Exception:  # noqa: BLE001
        logger.exception("langfuse: CallbackHandler init failed")
        return None


@contextmanager
def trace_root(
    name: str,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
    input: Any | None = None,
) -> Iterator[Any | None]:
    """
    Open a root span and propagate trace-level attributes to every child
    observation (including LangChain callbacks). Yields the span object, or
    None when Langfuse is disabled so callers can branch with `if span is not None`.
    """
    client = get_langfuse_client()
    if client is None:
        yield None
        return

    from langfuse import propagate_attributes

    with client.start_as_current_observation(
        as_type="span", name=name, input=input
    ) as span:
        if metadata:
            try:
                span.update(metadata=metadata)
            except Exception:  # noqa: BLE001
                logger.exception("langfuse: span.update(metadata=...) failed")
        with propagate_attributes(
            trace_name=name,
            user_id=user_id,
            session_id=session_id,
            tags=tags,
        ):
            yield span


def flush() -> None:
    """Flush queued events. Safe to call even when tracing is disabled."""
    client = get_langfuse_client()
    if client is not None:
        try:
            client.flush()
        except Exception:  # noqa: BLE001
            logger.exception("langfuse: flush failed")
