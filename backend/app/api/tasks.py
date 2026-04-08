"""
Tasks API routes -- CRUD, completion, comments.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskListResponse,
    TaskCommentCreate,
    TaskCommentResponse,
)
from app.schemas.auth import MessageResponse
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    task_status: str | None = Query(default=None, alias="status", max_length=50),
    assigned_to: uuid.UUID | None = Query(default=None),
    due_date: date | None = Query(default=None),
    due_date_from: date | None = Query(default=None),
    due_date_to: date | None = Query(default=None),
    priority: str | None = Query(default=None, max_length=20),
    task_type: str | None = Query(default=None, alias="type", max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await task_service.list_tasks(
        db,
        org_id,
        status=task_status,
        assigned_to=assigned_to,
        due_date=due_date,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        priority=priority,
        task_type=task_type,
        page=page,
        page_size=page_size,
    )


# ── Get ──────────────────────────────────────────────


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        task = await task_service.get_task(db, org_id, task_id)
        return TaskResponse.model_validate(task)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Create ───────────────────────────────────────────


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        task = await task_service.create_task(db, auth.org_id, auth.user_id, data)
        return TaskResponse.model_validate(task)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        task = await task_service.update_task(db, org_id, task_id, data)
        return TaskResponse.model_validate(task)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Complete ─────────────────────────────────────────


@router.patch("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        task = await task_service.complete_task(db, auth.org_id, task_id, auth.user_id)
        return TaskResponse.model_validate(task)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Delete ───────────────────────────────────────────


@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(
    task_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await task_service.delete_task(db, org_id, task_id)
        return MessageResponse(message="Task deleted.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Comments ─────────────────────────────────────────


@router.post(
    "/{task_id}/comments",
    response_model=TaskCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    task_id: uuid.UUID,
    data: TaskCommentCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        comment = await task_service.add_comment(
            db, auth.org_id, task_id, auth.user_id, data
        )
        return TaskCommentResponse.model_validate(comment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
