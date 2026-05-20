import io
import logging

from PIL import Image, ImageOps

from app.config import get_settings
from app.pipeline.state import PipelineState
from app.supabase_client import get_service_client

logger = logging.getLogger(__name__)

MAX_EDGE_PX = 1568  # gpt-4o ingests up to ~2048; 1568 keeps tokens reasonable.


def preprocess(state: PipelineState) -> PipelineState:
    settings = get_settings()
    storage_path = state["storage_path"]

    # Service-role read: the 'sketches' bucket has no anon/auth read policy.
    sb = get_service_client()
    raw = sb.storage.from_(settings.sketches_bucket).download(storage_path)
    if not raw:
        raise RuntimeError(f"sketch not found at {storage_path}")

    # EXIF strip + auto-orient + downscale.
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX), Image.Resampling.LANCZOS)

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88, optimize=True)
        cleaned = out.getvalue()

    logger.info(
        "preprocess: %s bytes -> %s bytes (path=%s)",
        len(raw),
        len(cleaned),
        storage_path,
    )

    return {
        **state,
        "image_bytes": cleaned,
        "image_mime": "image/jpeg",
        "warnings": state.get("warnings", []),
        "repair_count": 0,
    }
