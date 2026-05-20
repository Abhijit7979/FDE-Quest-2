import base64
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import Settings, get_settings
from app.pipeline.prompts import REPAIR_INSTRUCTION, SYSTEM_PROMPT
from app.pipeline.state import PipelineState

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
    settings: Settings, data_url: str, user_text: str
) -> str:
    llm = _build_openai_llm(settings)
    response = llm.invoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(
                content=[
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ]
            ),
        ]
    )
    return response.content if isinstance(response.content, str) else str(response.content)


def _extract_via_github_models(
    settings: Settings, data_url: str, user_text: str
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
        raise RuntimeError("GITHUB_TOKEN is required for vision_extract with llm_provider=github_models")

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
            AzSystemMessage(SYSTEM_PROMPT),
            AzUserMessage(
                content=[
                    TextContentItem(text=user_text),
                    ImageContentItem(image_url=ImageUrl(url=data_url)),
                ]
            ),
        ],
    )
    content = response.choices[0].message.content
    return content if isinstance(content, str) else str(content)


def vision_extract(state: PipelineState) -> PipelineState:
    settings = get_settings()
    image_bytes = state["image_bytes"]
    mime = state.get("image_mime", "image/jpeg")
    data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"

    user_text = "Extract every field from this sketch and emit the JSON."
    prior_error = state.get("validation_error")
    if prior_error:
        user_text = REPAIR_INSTRUCTION.format(error=prior_error)

    provider = settings.llm_provider.lower()
    if provider == "github_models":
        raw = _extract_via_github_models(settings, data_url, user_text)
    elif provider == "openai":
        raw = _extract_via_openai(settings, data_url, user_text)
    else:
        raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider!r}")

    logger.info(
        "vision_extract: provider=%s, %s chars (repair_count=%s)",
        provider,
        len(raw),
        state.get("repair_count", 0),
    )
    return {**state, "raw_extraction": raw}
