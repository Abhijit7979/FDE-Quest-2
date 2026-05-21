import json
import logging
from typing import Any

from app.pipeline.state import PipelineState
from app.schemas.definition import FieldType, OPTION_TYPES

logger = logging.getLogger(__name__)


def _coerce_field(raw: dict[str, Any], index: int, warnings: list[str]) -> dict[str, Any]:
    label = str(raw.get("label", "")).strip() or f"Field {index + 1}"

    ftype_raw = str(raw.get("type", "")).strip().lower().replace("-", "_")
    aliases = {
        "text": FieldType.SHORT_TEXT.value,
        "textarea": FieldType.LONG_TEXT.value,
        "paragraph": FieldType.LONG_TEXT.value,
        "radio": FieldType.SINGLE_CHOICE.value,
        "checkbox": FieldType.MULTI_CHOICE.value,
        "checkboxes": FieldType.MULTI_CHOICE.value,
        "select": FieldType.DROPDOWN.value,
        "yes/no": FieldType.YES_NO.value,
        "boolean": FieldType.YES_NO.value,
        "tel": FieldType.PHONE.value,
        "telephone": FieldType.PHONE.value,
        "file": FieldType.FILE_UPLOAD.value,
        "upload": FieldType.FILE_UPLOAD.value,
        "attachment": FieldType.FILE_UPLOAD.value,
        "image_upload": FieldType.FILE_UPLOAD.value,
    }
    ftype = aliases.get(ftype_raw, ftype_raw)
    try:
        field_type = FieldType(ftype)
    except ValueError:
        warnings.append(f"unknown type '{raw.get('type')}' on '{label}'; defaulted to short_text")
        field_type = FieldType.SHORT_TEXT

    out: dict[str, Any] = {
        "id": f"f_{index + 1}",
        "type": field_type.value,
        "label": label,
        "required": bool(raw.get("required", False)),
        "placeholder": raw.get("placeholder") or None,
        "needs_review": bool(raw.get("needs_review", False)),
    }

    if field_type in OPTION_TYPES:
        opts = raw.get("options") or []
        opts = [str(o).strip() for o in opts if str(o).strip()]
        if not opts:
            opts = ["Option 1", "Option 2"]
            out["needs_review"] = True
            warnings.append(f"'{label}' had no options; placeholder options inserted")
        out["options"] = opts

    return out


def structure(state: PipelineState) -> PipelineState:
    raw = state["raw_extraction"]
    warnings = list(state.get("warnings", []))

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        # Bubble up as a validation error so the repair node gets a shot.
        return {
            **state,
            "definition": {"version": 1, "fields": []},
            "validation_error": f"output was not valid JSON: {exc.msg}",
            "warnings": warnings,
        }

    fields_in = parsed.get("fields") if isinstance(parsed, dict) else None
    if not isinstance(fields_in, list):
        return {
            **state,
            "definition": {"version": 1, "fields": []},
            "validation_error": "top-level JSON must include a 'fields' array",
            "warnings": warnings,
        }

    coerced = [
        _coerce_field(f if isinstance(f, dict) else {}, i, warnings)
        for i, f in enumerate(fields_in)
    ]

    logger.info("structure: %s fields, %s warnings", len(coerced), len(warnings))

    return {
        **state,
        "definition": {"version": 1, "fields": coerced},
        "validation_error": None,
        "warnings": warnings,
    }
