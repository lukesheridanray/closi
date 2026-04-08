"""
Deal service -- CRUD, stage transitions with history logging.
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal
from app.models.stage_history import StageHistory
from app.models.pipeline import PipelineStage
from app.models.contact import Contact
from app.models.user import User
from app.schemas.deals import (
    DealCreate,
    DealUpdate,
    DealStageUpdate,
    DealResponse,
    DealDetailResponse,
    DealListResponse,
    DealImportRequest,
    DealImportResponse,
)
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_deals(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    pipeline_id: uuid.UUID | None = None,
    stage_id: uuid.UUID | None = None,
    assigned_to: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 25,
) -> DealListResponse:
    base = select(Deal).where(
        Deal.organization_id == org_id,
        Deal.is_deleted == False,  # noqa: E712
    )

    if pipeline_id:
        base = base.where(Deal.pipeline_id == pipeline_id)
    if stage_id:
        base = base.where(Deal.stage_id == stage_id)
    if assigned_to:
        base = base.where(Deal.assigned_to == assigned_to)
    if date_from:
        base = base.where(Deal.created_at >= date_from)
    if date_to:
        base = base.where(Deal.created_at <= date_to)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Deal.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    deals = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return DealListResponse(
        items=[DealResponse.model_validate(d) for d in deals],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_deal(
    db: AsyncSession,
    org_id: uuid.UUID,
    deal_id: uuid.UUID,
) -> Deal:
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.organization_id == org_id,
            Deal.is_deleted == False,  # noqa: E712
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise ValueError("Deal not found.")
    return deal


async def get_deal_detail(
    db: AsyncSession,
    org_id: uuid.UUID,
    deal_id: uuid.UUID,
) -> DealDetailResponse:
    """Get deal with resolved names for contact, stage, and assigned user."""
    deal = await get_deal(db, org_id, deal_id)

    contact_name = None
    if deal.contact_id:
        c_result = await db.execute(select(Contact).where(Contact.id == deal.contact_id))
        contact = c_result.scalar_one_or_none()
        if contact:
            contact_name = f"{contact.first_name} {contact.last_name}"

    stage_name = None
    if deal.stage_id:
        s_result = await db.execute(select(PipelineStage).where(PipelineStage.id == deal.stage_id))
        stage = s_result.scalar_one_or_none()
        if stage:
            stage_name = stage.name

    assigned_user_name = None
    if deal.assigned_to:
        u_result = await db.execute(select(User).where(User.id == deal.assigned_to))
        user = u_result.scalar_one_or_none()
        if user:
            assigned_user_name = f"{user.first_name} {user.last_name}"

    data = DealResponse.model_validate(deal).model_dump()
    data["contact_name"] = contact_name
    data["stage_name"] = stage_name
    data["assigned_user_name"] = assigned_user_name
    return DealDetailResponse(**data)


# ── Create ───────────────────────────────────────────


async def create_deal(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: DealCreate,
) -> Deal:
    deal = Deal(
        organization_id=org_id,
        **data.model_dump(),
    )
    if not deal.assigned_to:
        deal.assigned_to = user_id
    db.add(deal)
    await db.flush()

    # Log initial stage history
    history = StageHistory(
        organization_id=org_id,
        deal_id=deal.id,
        from_stage_id=None,
        to_stage_id=data.stage_id,
        moved_by=user_id,
        moved_at=datetime.utcnow(),
    )
    db.add(history)
    await db.flush()

    return deal


# ── Update ───────────────────────────────────────────


async def update_deal(
    db: AsyncSession,
    org_id: uuid.UUID,
    deal_id: uuid.UUID,
    data: DealUpdate,
) -> Deal:
    deal = await get_deal(db, org_id, deal_id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(deal, key, value)
    deal.updated_at = datetime.utcnow()
    await db.flush()
    return deal


# ── Stage Move ───────────────────────────────────────


async def move_stage(
    db: AsyncSession,
    org_id: uuid.UUID,
    deal_id: uuid.UUID,
    user_id: uuid.UUID,
    data: DealStageUpdate,
) -> Deal:
    deal = await get_deal(db, org_id, deal_id)
    old_stage_id = deal.stage_id

    if old_stage_id == data.stage_id:
        return deal

    # Verify target stage exists in same pipeline
    stage_result = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == data.stage_id,
            PipelineStage.pipeline_id == deal.pipeline_id,
            PipelineStage.organization_id == org_id,
        )
    )
    target_stage = stage_result.scalar_one_or_none()
    if not target_stage:
        raise ValueError("Target stage not found in this pipeline.")

    deal.stage_id = data.stage_id
    deal.updated_at = datetime.utcnow()

    # If moving to a won/lost stage, set closed_at
    if target_stage.is_won_stage or target_stage.is_lost_stage:
        deal.closed_at = datetime.utcnow()
    else:
        deal.closed_at = None

    # Log stage transition
    history = StageHistory(
        organization_id=org_id,
        deal_id=deal_id,
        from_stage_id=old_stage_id,
        to_stage_id=data.stage_id,
        moved_by=user_id,
        moved_at=datetime.utcnow(),
    )
    db.add(history)
    await db.flush()

    # === Stage-based automations ===
    stage_name = target_stage.name.lower().strip()

    # "Installed" → mark contact as customer, auto-charge equipment, start monitoring
    if target_stage.is_won_stage or stage_name == "installed":
        await _handle_installed(db, org_id, deal)

    return deal


async def _handle_installed(db: AsyncSession, org_id: uuid.UUID, deal: Deal) -> None:
    """When a deal moves to Installed: mark contact as customer and trigger billing."""
    import logging
    from app.models.contact import Contact

    logger = logging.getLogger(__name__)

    # Mark contact as customer
    contact_result = await db.execute(
        select(Contact).where(Contact.id == deal.contact_id, Contact.organization_id == org_id)
    )
    contact = contact_result.scalar_one_or_none()
    if contact and contact.status != "customer":
        contact.status = "customer"
        contact.updated_at = datetime.utcnow()
        logger.info(f"Contact {contact.id} marked as customer (deal installed)")

    # Auto-charge equipment via the install-complete trigger
    from app.services.task_service import _trigger_install_complete_charge
    try:
        await _trigger_install_complete_charge(db, org_id, deal.contact_id)
    except Exception as e:
        logger.error(f"Auto-charge on install failed for deal {deal.id}: {e}")


# ── Soft Delete ──────────────────────────────────────


async def delete_deal(
    db: AsyncSession,
    org_id: uuid.UUID,
    deal_id: uuid.UUID,
) -> None:
    deal = await get_deal(db, org_id, deal_id)
    deal.is_deleted = True
    deal.updated_at = datetime.utcnow()
    await db.flush()


# ── CSV Import ──────────────────────────────────────


async def import_deals(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: DealImportRequest,
) -> DealImportResponse:
    """
    Bulk import deals from CSV rows.
    For each row: match or create a contact, then create a deal.
    """
    # Validate pipeline + stage exist
    stage_result = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == data.stage_id,
            PipelineStage.pipeline_id == data.pipeline_id,
            PipelineStage.organization_id == org_id,
        )
    )
    if not stage_result.scalar_one_or_none():
        raise ValueError("Pipeline stage not found.")

    # Pre-load contacts for dedup (email + phone maps)
    contacts_result = await db.execute(
        select(Contact).where(
            Contact.organization_id == org_id,
            Contact.is_deleted == False,  # noqa: E712
        )
    )
    all_contacts = contacts_result.scalars().all()

    email_map: dict[str, Contact] = {}
    phone_map: dict[str, Contact] = {}
    for c in all_contacts:
        if c.email:
            email_map[c.email.lower()] = c
        if c.phone:
            digits = "".join(ch for ch in c.phone if ch.isdigit())
            if len(digits) == 10:
                phone_map[digits] = c

    imported = 0
    skipped = 0
    failed = 0
    contacts_created = 0
    contacts_matched = 0
    failed_rows: list[dict] = []

    for idx, row in enumerate(data.rows):
        try:
            # Must have at least first_name or last_name
            if not (row.first_name or row.last_name):
                failed += 1
                failed_rows.append({"row": idx + 1, "reason": "Missing name"})
                continue

            # Try to match existing contact
            matched_contact: Contact | None = None
            if row.email:
                matched_contact = email_map.get(row.email.lower())
            if not matched_contact and row.phone:
                digits = "".join(ch for ch in row.phone if ch.isdigit())
                if len(digits) == 10:
                    matched_contact = phone_map.get(digits)

            if matched_contact:
                contacts_matched += 1
                contact_id = matched_contact.id
            else:
                if data.duplicate_action == "skip" and matched_contact:
                    skipped += 1
                    continue

                # Create new contact
                new_contact = Contact(
                    organization_id=org_id,
                    first_name=row.first_name or "",
                    last_name=row.last_name or "",
                    email=row.email,
                    phone=row.phone,
                    company=row.company,
                    address=row.address,
                    city=row.city,
                    state=row.state,
                    zip=row.zip,
                    lead_source=data.lead_source_override or row.lead_source or "other",
                    status="new",
                    assigned_to=data.assigned_to_override,
                )
                db.add(new_contact)
                await db.flush()
                contact_id = new_contact.id
                contacts_created += 1

                # Add to dedup maps
                if new_contact.email:
                    email_map[new_contact.email.lower()] = new_contact
                if new_contact.phone:
                    digits = "".join(ch for ch in new_contact.phone if ch.isdigit())
                    if len(digits) == 10:
                        phone_map[digits] = new_contact

            # Parse expected_close_date
            close_date = None
            if row.expected_close_date:
                try:
                    close_date = datetime.fromisoformat(row.expected_close_date)
                except ValueError:
                    pass

            # Create the deal
            deal = Deal(
                organization_id=org_id,
                contact_id=contact_id,
                pipeline_id=data.pipeline_id,
                stage_id=data.stage_id,
                title=row.title,
                estimated_value=row.estimated_value or 0,
                notes=row.notes,
                expected_close_date=close_date,
                assigned_to=data.assigned_to_override or user_id,
            )
            db.add(deal)
            await db.flush()

            # Log stage history
            history = StageHistory(
                organization_id=org_id,
                deal_id=deal.id,
                from_stage_id=None,
                to_stage_id=data.stage_id,
                moved_by=user_id,
                moved_at=datetime.utcnow(),
            )
            db.add(history)
            imported += 1

        except Exception as exc:
            failed += 1
            failed_rows.append({"row": idx + 1, "reason": str(exc)})

    await db.flush()

    return DealImportResponse(
        imported=imported,
        skipped=skipped,
        failed=failed,
        contacts_created=contacts_created,
        contacts_matched=contacts_matched,
        failed_rows=failed_rows,
    )
