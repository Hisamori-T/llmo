"""OpenAI GPT-4o provider."""
import asyncio

from openai import AsyncOpenAI

from app.config import settings
from .base import LLMResponse

_MODEL = 'gpt-4o'
_INPUT_COST_PER_1K = 0.005    # USD
_OUTPUT_COST_PER_1K = 0.015


async def ask_gpt4o(prompt: str, timeout: float = 45.0) -> LLMResponse:
    if not settings.openai_api_key:
        return LLMResponse(text='', raw='', model='gpt4o', error='openai_api_key not configured')

    async def _call() -> str:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model=_MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ''

    try:
        text = await asyncio.wait_for(_call(), timeout=timeout)
        tokens_in = len(prompt) // 4
        tokens_out = len(text) // 4
        cost = (tokens_in / 1000) * _INPUT_COST_PER_1K + (tokens_out / 1000) * _OUTPUT_COST_PER_1K
        return LLMResponse(text=text, raw=text, model='gpt4o', cost_usd=cost)
    except asyncio.TimeoutError:
        return LLMResponse(text='', raw='', model='gpt4o', error='timeout')
    except Exception as e:
        return LLMResponse(text='', raw='', model='gpt4o', error=str(e))
