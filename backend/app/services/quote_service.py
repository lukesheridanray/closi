"""
Quote service -- CRUD, PDF generation stub, accept/convert to contract.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quote import Quote
from app.models.deal import Deal
from app.models.contract import Contract
from app.models.subscription import Subscription
from app.models.pipeline import PipelineStage
from app.models.activity import Activity
from app.schemas.quotes import (
    QuoteCreate,
    QuoteUpdate,
    QuoteResponse,
    QuoteListResponse,
)
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_quotes(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    deal_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 25,
) -> QuoteListResponse:
    base = select(Quote).where(Quote.organization_id == org_id)

    if deal_id:
        base = base.where(Quote.deal_id == deal_id)
    if contact_id:
        base = base.where(Quote.contact_id == contact_id)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Quote.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    quotes = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return QuoteListResponse(
        items=[QuoteResponse.model_validate(q) for q in quotes],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_quote(
    db: AsyncSession,
    org_id: uuid.UUID,
    quote_id: uuid.UUID,
) -> Quote:
    result = await db.execute(
        select(Quote).where(
            Quote.id == quote_id,
            Quote.organization_id == org_id,
        )
    )
    quote = result.scalar_one_or_none()
    if not quote:
        raise ValueError("Quote not found.")
    return quote


# ── Create ───────────────────────────────────────────


async def create_quote(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: QuoteCreate,
) -> Quote:
    quote = Quote(
        organization_id=org_id,
        created_by=user_id,
        status="draft",
        **data.model_dump(),
    )
    db.add(quote)
    await db.flush()
    return quote


# ── Update ───────────────────────────────────────────


async def update_quote(
    db: AsyncSession,
    org_id: uuid.UUID,
    quote_id: uuid.UUID,
    data: QuoteUpdate,
) -> Quote:
    quote = await get_quote(db, org_id, quote_id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(quote, key, value)
    quote.updated_at = datetime.utcnow()
    await db.flush()
    return quote


# ── Send (email to customer) ────────────────────────


async def send_quote(
    db: AsyncSession,
    org_id: uuid.UUID,
    quote_id: uuid.UUID,
) -> Quote:
    """Mark quote as sent and email it to the customer."""
    import logging
    from app.models.contact import Contact
    from app.services import notification_service

    logger = logging.getLogger(__name__)
    quote = await get_quote(db, org_id, quote_id)

    if quote.status not in ("draft", "sent"):
        raise ValueError(f"Cannot send quote with status '{quote.status}'.")

    quote.status = "sent"
    quote.sent_at = datetime.utcnow()
    quote.updated_at = datetime.utcnow()

    # Look up contact email
    contact_result = await db.execute(
        select(Contact).where(Contact.id == quote.contact_id)
    )
    contact = contact_result.scalar_one_or_none()

    if contact and contact.email:
        from app.models.organization import Organization
        org_result = await db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = org_result.scalar_one_or_none()
        org_name = org.name if org else "LSRV CRM"
        contact_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or "Customer"

        from app.api.quotes import get_quote_response_url
        accept_url = get_quote_response_url(quote.id, org_id, "accept")
        decline_url = get_quote_response_url(quote.id, org_id, "decline")

        try:
            await notification_service.send_quote_email(
                to=contact.email,
                contact_name=contact_name,
                quote_title=quote.title,
                org_name=org_name,
                equipment_lines=quote.equipment_lines or [],
                equipment_total=float(quote.equipment_total or 0),
                monthly_amount=float(quote.monthly_monitoring_amount or 0),
                notes=quote.notes,
                accept_url=accept_url,
                decline_url=decline_url,
            )
        except Exception as e:
            logger.error(f"Failed to send quote email for {quote.id}: {e}")

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=quote.contact_id,
        type="quote_sent",
        subject=f"Quote sent: {quote.title}",
        description=f"Equipment: ${float(quote.equipment_total):.2f}, Monitoring: ${float(quote.monthly_monitoring_amount):.2f}/mo",
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()
    return quote


# ── Accept (convert to contract) ─────────────────────


async def accept_quote(
    db: AsyncSession,
    org_id: uuid.UUID,
    quote_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Contract:
    """Accept a quote: mark accepted, create contract, create subscription,
    and move deal to won stage."""
    quote = await get_quote(db, org_id, quote_id)

    if quote.status == "accepted":
        raise ValueError("Quote is already accepted.")

    quote.status = "accepted"
    quote.accepted_at = datetime.utcnow()
    quote.updated_at = datetime.utcnow()

    # Create contract from quote
    contract = Contract(
        organization_id=org_id,
        contact_id=quote.contact_id,
        deal_id=quote.deal_id,
        quote_id=quote.id,
        title=quote.title,
        status="active",
        monthly_amount=quote.monthly_monitoring_amount,
        equipment_total=quote.equipment_total,
        term_months=quote.contract_term_months,
        total_value=quote.total_contract_value,
        equipment_lines=quote.equipment_lines,
        start_date=datetime.utcnow(),
        signed_at=datetime.utcnow(),
    )
    db.add(contract)
    await db.flush()

    # Create subscription for recurring billing
    if quote.monthly_monitoring_amount and quote.monthly_monitoring_amount > 0:
        # Try to create a real ARB subscription at Authorize.net
        arb_created = False
        try:
            from app.integrations import authnet_service
            arb_sub = await authnet_service.create_subscription(
                db, org_id, contract.id
            )
            arb_created = True
            import logging
            logging.getLogger(__name__).info(
                f"ARB subscription created for contract {contract.id}: {arb_sub.external_subscription_id}"
            )
        except Exception as e:
            # ARB failed (no card on file, no authnet config, etc.)
            # Create local subscription record anyway so the UI shows monitoring is set up
            import logging
            logging.getLogger(__name__).warning(
                f"Could not create ARB subscription for contract {contract.id}: {e}. "
                f"Local subscription created — ARB needs manual setup."
            )
            subscription = Subscription(
                organization_id=org_id,
                contract_id=contract.id,
                contact_id=quote.contact_id,
                status="active",
                amount=quote.monthly_monitoring_amount,
                currency="usd",
                billing_interval="monthly",
                billing_interval_count=1,
            )
            db.add(subscription)
            await db.flush()

    # Move deal to won stage if deal exists
    if quote.deal_id:
        deal_result = await db.execute(
            select(Deal).where(
                Deal.id == quote.deal_id,
                Deal.organization_id == org_id,
            )
        )
        deal = deal_result.scalar_one_or_none()
        if deal:
            # Update deal value from the quote
            deal.estimated_value = float(quote.total_contract_value or quote.equipment_total or 0)
            deal.updated_at = datetime.utcnow()

            # Find won stage in the deal's pipeline
            won_stage_result = await db.execute(
                select(PipelineStage).where(
                    PipelineStage.pipeline_id == deal.pipeline_id,
                    PipelineStage.organization_id == org_id,
                    PipelineStage.is_won_stage == True,  # noqa: E712
                )
            )
            won_stage = won_stage_result.scalar_one_or_none()
            if won_stage:
                deal.stage_id = won_stage.id
                deal.closed_at = datetime.utcnow()
                deal.updated_at = datetime.utcnow()

    # Log activity
    activity = Activity(
        organization_id=org_id,
        contact_id=quote.contact_id,
        deal_id=quote.deal_id,
        type="quote_sent",
        subject=f"Quote accepted: {quote.title}",
        description=f"Contract created with ${quote.monthly_monitoring_amount}/mo monitoring",
        performed_by=user_id,
        performed_at=datetime.utcnow(),
    )
    db.add(activity)
    await db.flush()

    return contract


# ── PDF Generation ───────────────────────────────────


async def generate_pdf(
    db: AsyncSession,
    org_id: uuid.UUID,
    quote_id: uuid.UUID,
) -> bytes:
    """Generate a branded PDF for the quote. Returns PDF bytes."""
    from app.models.contact import Contact
    from app.models.organization import Organization
    from app.services.pdf_service import generate_quote_pdf

    quote = await get_quote(db, org_id, quote_id)

    # Fetch contact
    contact_result = await db.execute(
        select(Contact).where(Contact.id == quote.contact_id, Contact.organization_id == org_id)
    )
    contact = contact_result.scalar_one_or_none()
    contact_name = f"{contact.first_name} {contact.last_name}" if contact else "Customer"
    contact_addr_parts = [p for p in [
        contact.address if contact else None,
        f"{contact.city}, {contact.state} {contact.zip}" if contact and contact.city else None,
    ] if p]
    contact_address = "\n".join(contact_addr_parts) if contact_addr_parts else ""

    # Fetch organization
    org_result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "LSRV CRM"
    org_addr_parts = [p for p in [
        org.address_line1 if org else None,
        f"{org.city}, {org.state} {org.zip}" if org and org.city else None,
    ] if p]
    org_address = "\n".join(org_addr_parts) if org_addr_parts else ""

    return generate_quote_pdf(
        org_name=org_name,
        org_address=org_address,
        contact_name=contact_name,
        contact_address=contact_address,
        quote_title=quote.title,
        quote_status=quote.status,
        equipment_lines=quote.equipment_lines,
        equipment_total=float(quote.equipment_total or 0),
        monthly_monitoring=float(quote.monthly_monitoring_amount or 0),
        term_months=quote.contract_term_months or 36,
        auto_renewal=quote.auto_renewal if quote.auto_renewal is not None else True,
        total_contract_value=float(quote.total_contract_value or 0),
        valid_until=str(quote.valid_until.date()) if quote.valid_until else None,
        notes=quote.notes,
        created_at=str(quote.created_at),
    )
