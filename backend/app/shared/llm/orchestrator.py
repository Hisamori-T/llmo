"""Multi-LLM orchestrator — parallel Gemini + GPT-4o with partial-success tolerance."""
import asyncio
from typing import Optional

from .base import LLMResponse
from .gemini_provider import ask_gemini
from .openai_provider import ask_gpt4o


async def ask_parallel(
    prompt: str,
    timeout: float = 45.0,
) -> dict[str, LLMResponse]:
    """Query Gemini and GPT-4o concurrently. Returns both results even on partial failure."""
    gemini_task = asyncio.create_task(ask_gemini(prompt, timeout))
    gpt4o_task = asyncio.create_task(ask_gpt4o(prompt, timeout))

    results: dict[str, LLMResponse] = {}
    for model_name, task in [('gemini', gemini_task), ('gpt4o', gpt4o_task)]:
        try:
            results[model_name] = await task
        except Exception as e:
            results[model_name] = LLMResponse(text='', raw='', model=model_name, error=str(e))

    return results


async def ask_single(
    prompt: str,
    model: str = 'gemini',
    timeout: float = 45.0,
) -> LLMResponse:
    if model == 'gpt4o':
        return await ask_gpt4o(prompt, timeout)
    return await ask_gemini(prompt, timeout)
