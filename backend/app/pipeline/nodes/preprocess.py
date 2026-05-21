import io
import logging

from PIL import Image, ImageOps

from app.config import get_settings
from app.pipeline.state import PipelineState, ProcessedImage
from app.supabase_client import get_service_client

logger = logging.getLogger(__name__)

MAX_EDGE_PX = 1568  # gpt-4o ingests up to ~2048; 1568 keeps tokens reasonable.


def _process_bytes(raw: bytes) -> ProcessedImage:
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX), Image.Resampling.LANCZOS)

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88, optimize=True)
        cleaned = out.getvalue()

    return {"bytes": cleaned, "mime": "image/jpeg"}


def preprocess(state: PipelineState) -> PipelineState:
    paths = state.get("storage_paths") or []
    if not paths and state.get("storage_path"):
        paths = [state["storage_path"]]

    images: list[ProcessedImage] = []
    if paths:
        settings = get_settings()
        sb = get_service_client()
        for storage_path in paths:
            raw = sb.storage.from_(settings.sketches_bucket).download(storage_path)
            if not raw:
                raise RuntimeError(f"sketch not found at {storage_path}")
            processed = _process_bytes(raw)
            images.append(processed)
            logger.info(
                "preprocess: %s bytes -> %s bytes (path=%s)",
                len(raw),
                len(processed["bytes"]),
                storage_path,
            )

    # Backward compat for any code still reading single image keys.
    first = images[0] if images else None
    out: PipelineState = {
        **state,
        "images": images,
        "warnings": state.get("warnings", []),
        "repair_count": state.get("repair_count", 0),
    }
    if first:
        out["image_bytes"] = first["bytes"]
        out["image_mime"] = first["mime"]
    return out
