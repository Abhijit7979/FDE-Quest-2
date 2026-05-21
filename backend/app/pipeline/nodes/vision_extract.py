import base64
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import Settings, get_settings
from app.pipeline.prompts import (
    REPAIR_INSTRUCTION,
    SYSTEM_PROMPT,
    TEXT_ONLY_SYSTEM_PROMPT,
)
from app.pipeline.state import PipelineState, ProcessedImage

logger = logging.getLogger(__name__)


def _build_openai_llm(settings: Settings) -> ChatOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for vision_extract")
    return ChatOpenAI(
        model=settings.openai_vision_model,
        api_key=settings.openai_api_key,
        temperature=0,
        max_tokens=4096,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def _extract_via_openai(
    settings: Settings,
    system_prompt: str,
    user_content: str | list[str | dict[str, Any]],
) -> str:
    llm = _build_openai_llm(settings)
    response = llm.invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_content),
        ]
    )
    return response.content if isinstance(response.content, str) else str(response.content)


def _extract_via_github_models(
    settings: Settings,
    system_prompt: str,
    user_content: list[Any],
) -> str:
    from azure.ai.inference import ChatCompletionsClient
    from azure.ai.inference.models import (
        ImageContentItem,
        ImageUrl,
        SystemMessage as AzSystemMessage,
        TextContentItem,
        UserMessage as AzUserMessage,
    )
    from azure.core.credentials import AzureKeyCredential

    if not settings.github_token:
        raise RuntimeError(
            "GITHUB_TOKEN is required for vision_extract with llm_provider=github_models"
        )

    client = ChatCompletionsClient(
        endpoint=settings.github_models_endpoint,
        credential=AzureKeyCredential(settings.github_token),
    )
    response = client.complete(
        model=settings.github_model,
        temperature=0.0,
        top_p=1.0,
        max_tokens=4096,
        messages=[
            AzSystemMessage(system_prompt),
            AzUserMessage(content=user_content),
        ],
    )
    content = response.choices[0].message.content
    return content if isinstance(content, str) else str(content)


def _build_user_text(state: PipelineState, *, image_count: int) -> str:
    description = (state.get("description") or "").strip()
    prior_error = state.get("validation_error")
    if prior_error:
        return REPAIR_INSTRUCTION.format(error=prior_error)

    if image_count == 0:
        return (
            "The creator described this form in words:\n\n"
            f"{description}\n\n"
            "Infer every field and emit the JSON."
        )

    base = "Extract every field from the sketch"
    if image_count > 1:
        base += f" images ({image_count} pages)"
    base += " and emit the JSON."

    if description:
        return f"Creator notes:\n{description}\n\n{base}"
    return base


def _images_from_state(state: PipelineState) -> list[ProcessedImage]:
    images = state.get("images") or []
    if images:
        return images
    if state.get("image_bytes"):
        return [
            {
                "bytes": state["image_bytes"],
                "mime": state.get("image_mime", "image/jpeg"),
            }
        ]
    return []


def vision_extract(state: PipelineState) -> PipelineState:
    from azure.ai.inference.models import ImageContentItem, ImageUrl, TextContentItem

    settings = get_settings()
    images = _images_from_state(state)
    description = (state.get("description") or "").strip()

    if not images and not description:
        raise RuntimeError("vision_extract requires images and/or a description")

    user_text = _build_user_text(state, image_count=len(images))
    text_only = len(images) == 0
    system_prompt = TEXT_ONLY_SYSTEM_PROMPT if text_only else SYSTEM_PROMPT

    provider = settings.llm_provider.lower()

    if text_only:
        if provider == "github_models":
            raw = _extract_via_github_models(
                settings,
                system_prompt,
                [TextContentItem(text=user_text)],
            )
        elif provider == "openai":
            raw = _extract_via_openai(settings, system_prompt, user_text)
        else:
            raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider!r}")
    else:
        openai_parts: list[str | dict[str, Any]] = [
            {"type": "text", "text": user_text},
        ]
        github_parts: list[Any] = [TextContentItem(text=user_text)]

        for img in images:
            data_url = (
                f"data:{img['mime']};base64,"
                f"{base64.b64encode(img['bytes']).decode('ascii')}"
            )
            openai_parts.append(
                {"type": "image_url", "image_url": {"url": data_url}},
            )
            github_parts.append(
                ImageContentItem(image_url=ImageUrl(url=data_url)),
            )

        if provider == "github_models":
            raw = _extract_via_github_models(settings, system_prompt, github_parts)
        elif provider == "openai":
            raw = _extract_via_openai(settings, system_prompt, openai_parts)
        else:
            raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider!r}")

    logger.info(
        "vision_extract: provider=%s, %s chars, images=%s, text_only=%s (repair_count=%s)",
        provider,
        len(raw),
        len(images),
        text_only,
        state.get("repair_count", 0),
    )
    return {**state, "raw_extraction": raw}
