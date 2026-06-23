"""Common LLM response type and interface contract."""
from dataclasses import dataclass, field
from typing import Literal, Optional

ModelName = Literal['gemini', 'gpt4o']


@dataclass
class LLMResponse:
    text: str
    raw: str
    model: ModelName
    cost_usd: float = 0.0
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.error is None and bool(self.text)
