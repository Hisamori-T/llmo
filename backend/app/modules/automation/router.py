"""Automation router — スケジュール管理 API。"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.shared.api.deps import get_current_user
from .schemas import (
    CreateScheduleRequest, LogResponse, ScheduleResponse, UpdateScheduleRequest,
)
from .services import create_schedule, list_logs, list_schedules, update_schedule

router = APIRouter(tags=['automation'])


@router.post('/schedules', response_model=ScheduleResponse, status_code=201)
async def create(
    body: CreateScheduleRequest,
    current_user = Depends(get_current_user),
):
    try:
        doc = await create_schedule(
            agency_id=current_user.agency_id,
            client_id=body.client_id,
            member_id=current_user.member_id,
            schedule_type=body.schedule_type,
            execution_day=body.execution_day,
            execution_time=body.execution_time,
            channels=body.channels,
            recipients=body.recipients.model_dump() if body.recipients else None,
            tasks=body.tasks,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return doc


@router.get('/schedules', response_model=list[ScheduleResponse])
async def list_all(
    client_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
):
    return await list_schedules(agency_id=current_user.agency_id, client_id=client_id)


@router.patch('/schedules/{schedule_id}', response_model=ScheduleResponse)
async def update(
    schedule_id: str,
    body: UpdateScheduleRequest,
    current_user = Depends(get_current_user),
):
    try:
        return await update_schedule(
            schedule_id=schedule_id,
            agency_id=current_user.agency_id,
            updates=body.model_dump(exclude_none=True),
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get('/logs', response_model=list[LogResponse])
async def get_logs(
    schedule_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user = Depends(get_current_user),
):
    return await list_logs(
        agency_id=current_user.agency_id,
        schedule_id=schedule_id,
        limit=limit,
    )
