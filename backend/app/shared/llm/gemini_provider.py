"""Gemini 2.5 Flash provider."""
import asyncio

from google import genai

from app.config import settings
from .base import LLMResponse

_MODEL = 'gemini-2.5-flash'
_INPUT_COST_PER_1K = 0.000075   # USD (approximate)
_OUTPUT_COST_PER_1K = 0.0003


async def ask_gemini(prompt: str, timeout: float = 45.0) -> LLMResponse:
    def _sync() -> str:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(temperature=0),
        )
        return response.text or ''

    try:
        text = await asyncio.wait_for(asyncio.to_thread(_sync), timeout=timeout)
        tokens_in = len(prompt) // 4
        tokens_out = len(text) // 4
        cost = (tokens_in / 1000) * _INPUT_COST_PER_1K + (tokens_out / 1000) * _OUTPUT_COST_PER_1K
        return LLMResponse(text=text, raw=text, model='gemini', cost_usd=cost)
    except asyncio.TimeoutError:
        return LLMResponse(text='', raw='', model='gemini', error='timeout')
    except Exception as e:
        return LLMResponse(text='', raw='', model='gemini', error=str(e))
