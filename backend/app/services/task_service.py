"""
Task service -- CRUD, completion logging, overdue detection.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskComment
from app.models.activity import Activity
from app.schemas.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskListResponse,
    TaskCommentCreate,
    TaskCommentResponse,
)
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_tasks(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    status: str | None = None,
    assigned_to: uuid.UUID | None = None,
    due_date: date | None = None,
    due_date_from: date | None = None,
    due_date_to: date | None = None,
    priority: str | None = None,
    task_type: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> TaskListResponse:
    base = select(Task).where(
        Task.organization_id == org_id,
        Task.is_deleted == False,  # noqa: E712
    )

    if status:
        base = base.where(Task.status == status)
    if assigned_to:
        base = base.where(Task.assigned_to == assigned_to)
    if due_date:
        base = base.where(Task.due_date == due_date)
    if due_date_from:
        base = base.where(Task.due_date >= due_date_from)
    if due_date_to:
        base = base.where(Task.due_date <= due_date_to)
    if priority:
        base = base.where(Task.priority == priority)
    if task_type:
        base = base.where(Task.type == task_type)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    tasks = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return TaskListResponse(
        items=[TaskResponse.model_validate(t) for t in tasks],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_task(
    db: AsyncSession,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
) -> Task:
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.organization_id == org_id,
            Task.is_deleted == False,  # noqa: E712
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise ValueError("Task not found.")
    return task


# ── Create ───────────────────────────────────────────


async def create_task(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: TaskCreate,
) -> Task:
    task = Task(
        organization_id=org_id,
        created_by=user_id,
        **data.model_dump(),
    )
    if not task.assigned_to:
        task.assigned_to = user_id
    db.add(task)
    await db.flush()

    # Log activity if linked to a contact
    if task.contact_id:
        activity = Activity(
            organization_id=org_id,
            contact_id=task.contact_id,
            deal_id=task.deal_id,
            type="task_created",
            subject=f"Task created: {task.title}",
            description=task.description,
            performed_by=user_id,
            performed_at=datetime.utcnow(),
        )
        db.add(activity)
        await db.flush()

    return task


# ── Update ───────────────────────────────────────────


async def update_task(
    db: AsyncSession,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    data: TaskUpdate,
) -> Task:
    task = await get_task(db, org_id, task_id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(task, key, value)
    task.updated_at = datetime.utcnow()
    await db.flush()
    return task


# ── Complete ─────────────────────────────────────────


async def complete_task(
    db: AsyncSession,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Task:
    task = await get_task(db, org_id, task_id)
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    task.completed_by = user_id
    task.updated_at = datetime.utcnow()
    await db.flush()

    # Log activity if linked to a contact
    if task.contact_id:
        activity = Activity(
            organization_id=org_id,
            contact_id=task.contact_id,
            deal_id=task.deal_id,
            type="task_completed",
            subject=f"Task completed: {task.title}",
            performed_by=user_id,
            performed_at=datetime.utcnow(),
        )
        db.add(activity)
        await db.flush()

    # Auto-charge trigger: when an install task is completed,
    # charge the card on file for accepted quote equipment total
    if task.type == "install" and task.contact_id:
        await _trigger_install_complete_charge(db, org_id, task.contact_id)

    return task


async def _trigger_install_complete_charge(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> None:
    """When an install is marked complete, auto-charge the equipment amount
    from the accepted quote and start monitoring if quoted."""
    import logging
    from app.models.quote import Quote
    from app.models.payment import Payment

    logger = logging.getLogger(__name__)

    # Find accepted quotes for this contact with equipment charges
    result = await db.execute(
        select(Quote).where(
            Quote.organization_id == org_id,
            Quote.contact_id == contact_id,
            Quote.status == "accepted",
            Quote.equipment_total > 0,
        )
    )
    accepted_quotes = list(result.scalars().all())
    if not accepted_quotes:
        return

    # Calculate total equipment quoted vs already paid
    total_equipment_quoted = sum(float(q.equipment_total) for q in accepted_quotes)

    payments_result = await db.execute(
        select(Payment).where(
            Payment.organization_id == org_id,
            Payment.contact_id == contact_id,
            Payment.status == "succeeded",
        )
    )
    total_paid = sum(float(p.amount) for p in payments_result.scalars().all())
    equipment_owed = total_equipment_quoted - total_paid

    if equipment_owed <= 0:
        logger.info(f"Install complete for contact {contact_id}: equipment already paid")
        return

    # Auto-charge via Authorize.net
    try:
        from app.integrations import authnet_service

        payment = await authnet_service.charge_customer(
            db, org_id, contact_id,
            amount=round(equipment_owed, 2),
            description="Equipment & installation charge (auto-billed on install completion)",
        )
        if payment.status == "succeeded":
            logger.info(f"Install complete auto-charge succeeded: ${equipment_owed:.2f} for contact {contact_id}")
        else:
            logger.warning(f"Install complete auto-charge failed for contact {contact_id}: {payment.failure_message}")
            # Create a follow-up task for failed charge
            failed_task = Task(
                organization_id=org_id,
                contact_id=contact_id,
                title=f"Failed auto-charge: ${equipment_owed:.2f} equipment",
                description=f"Install was marked complete but the auto-charge failed: {payment.failure_message or 'Unknown reason'}. Please charge manually.",
                type="follow_up",
                priority="urgent",
                status="pending",
            )
            db.add(failed_task)
    except Exception as e:
        logger.error(f"Install complete auto-charge error for contact {contact_id}: {e}")
        # Create a follow-up task so billing isn't lost
        error_task = Task(
            organization_id=org_id,
            contact_id=contact_id,
            title=f"Billing needed: ${equipment_owed:.2f} equipment",
            description=f"Install was marked complete but auto-charge failed: {e}. No card on file or billing not configured. Please charge manually.",
            type="follow_up",
            priority="urgent",
            status="pending",
        )
        db.add(error_task)


# ── Soft Delete ──────────────────────────────────────


async def delete_task(
    db: AsyncSession,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
) -> None:
    task = await get_task(db, org_id, task_id)
    task.is_deleted = True
    task.updated_at = datetime.utcnow()
    await db.flush()


# ── Comments ─────────────────────────────────────────


async def add_comment(
    db: AsyncSession,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    data: TaskCommentCreate,
) -> TaskComment:
    # Verify task exists
    await get_task(db, org_id, task_id)

    comment = TaskComment(
        organization_id=org_id,
        task_id=task_id,
        user_id=user_id,
        content=data.content,
    )
    db.add(comment)
    await db.flush()
    return comment


async def list_comments(
    db: AsyncSession,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
) -> list[TaskCommentResponse]:
    result = await db.execute(
        select(TaskComment)
        .where(
            TaskComment.task_id == task_id,
            TaskComment.organization_id == org_id,
        )
        .order_by(TaskComment.created_at.asc())
    )
    comments = result.scalars().all()
    return [TaskCommentResponse.model_validate(c) for c in comments]


# ── Overdue Detection ────────────────────────────────


async def get_overdue_tasks(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> list[Task]:
    today = date.today()
    result = await db.execute(
        select(Task).where(
            Task.organization_id == org_id,
            Task.is_deleted == False,  # noqa: E712
            Task.status.in_(["pending", "in_progress"]),
            Task.due_date < today,
        )
    )
    return list(result.scalars().all())
