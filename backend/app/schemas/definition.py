from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class FieldType(StrEnum):
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    EMAIL = "email"
    NUMBER = "number"
    PHONE = "phone"
    SINGLE_CHOICE = "single_choice"
    MULTI_CHOICE = "multi_choice"
    DROPDOWN = "dropdown"
    DATE = "date"
    YES_NO = "yes_no"
    FILE_UPLOAD = "file_upload"


OPTION_TYPES: frozenset[FieldType] = frozenset(
    {FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE, FieldType.DROPDOWN}
)


class FormField(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    type: FieldType
    label: str = Field(min_length=1, max_length=240)
    required: bool = False
    placeholder: str | None = None
    options: list[str] | None = None
    needs_review: bool = False

    @model_validator(mode="after")
    def _options_match_type(self) -> "FormField":
        if self.type in OPTION_TYPES:
            if not self.options or len(self.options) < 1:
                raise ValueError(
                    f"field '{self.id}' has type '{self.type.value}' "
                    "and must include a non-empty options[]"
                )
        else:
            if self.options:
                raise ValueError(
                    f"field '{self.id}' has type '{self.type.value}' "
                    "and must not include options[]"
                )
        return self


class Definition(BaseModel):
    version: Literal[1] = 1
    fields: list[FormField] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_field_ids(self) -> "Definition":
        seen: set[str] = set()
        for f in self.fields:
            if f.id in seen:
                raise ValueError(f"duplicate field id: {f.id}")
            seen.add(f.id)
        return self
