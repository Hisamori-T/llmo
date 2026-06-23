"""Automation module schemas (Pydantic v2)."""
from typing import Optional
from pydantic import BaseModel, field_validator


class RecipientsSchema(BaseModel):
    user_ids: list[str] = []
    extra_emails: list[str] = []


class CreateScheduleRequest(BaseModel):
    client_id: str
    schedule_type: str  # weekly | monthly
    execution_day: int
    execution_time: str = '09:00'
    channels: list[str] = ['email']
    recipients: Optional[RecipientsSchema] = None
    tasks: list[str] = ['diagnose', 'report']

    @field_validator('schedule_type')
    @classmethod
    def validate_schedule_type(cls, v: str) -> str:
        if v not in ('weekly', 'monthly', 'custom'):
            raise ValueError('schedule_type must be weekly, monthly, or custom')
        return v

    @field_validator('execution_day')
    @classmethod
    def validate_execution_day(cls, v: int, info) -> int:
        stype = info.data.get('schedule_type', '')
        if stype == 'monthly' and not (1 <= v <= 28):
            raise ValueError('monthly execution_day must be 1-28')
        if stype == 'weekly' and not (0 <= v <= 6):
            raise ValueError('weekly execution_day must be 0-6 (Python weekday)')
        return v

    @field_validator('channels')
    @classmethod
    def validate_channels(cls, v: list) -> list:
        allowed = {'email', 'slack', 'line'}
        for ch in v:
            if ch not in allowed:
                raise ValueError(f'channel must be one of {allowed}')
        return v


class UpdateScheduleRequest(BaseModel):
    execution_day: Optional[int] = None
    execution_time: Optional[str] = None
    channels: Optional[list[str]] = None
    recipients: Optional[RecipientsSchema] = None
    tasks: Optional[list[str]] = None
    status: Optional[str] = None  # active | paused


class ScheduleResponse(BaseModel):
    id: str
    agency_id: str
    client_id: str
    member_id: Optional[str] = None
    schedule_type: str
    execution_day: int
    execution_time: str
    channels: list
    recipients: Optional[dict] = None
    tasks: list
    last_execution: Optional[str] = None
    next_execution: Optional[str] = None
    status: str
    created_at: str

    model_config = {'from_attributes': True}


class LogResponse(BaseModel):
    id: str
    schedule_id: str
    agency_id: str
    client_id: str
    executed_at: str
    diff: Optional[dict] = None
    alert_level: str
    hallucination_findings: Optional[list] = None
    tasks_completed: Optional[list] = None
    tasks_failed: Optional[list] = None
    credits_consumed: int
    error_details: Optional[str] = None

    model_config = {'from_attributes': True}
