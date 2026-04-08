"""
Invoice service -- CRUD, PDF generation stub, send email, overdue detection,
and automatic invoice creation for every payment.
"""

import logging
import uuid
from datetime import date, datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.contact import Contact
from app.models.payment import Payment
from app.schemas.invoices import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceListResponse,
)
from app.schemas.common import PaginationMeta

logger = logging.getLogger(__name__)


# ── Auto Invoice Number ─────────────────────────────


async def _next_invoice_number(db: AsyncSession, org_id: uuid.UUID) -> str:
    """Generate the next sequential invoice number for the org (INV-YYYY-NNNN).

    Uses SELECT ... FOR UPDATE on the org row to serialize concurrent access.
    """
    from app.models.organization import Organization

    year = date.today().year
    prefix = f"INV-{year}-"

    # Lock the org row to prevent concurrent invoice number generation
    await db.execute(
        select(Organization.id)
        .where(Organization.id == org_id)
        .with_for_update()
    )

    result = await db.execute(
        select(func.max(Invoice.invoice_number))
        .where(
            Invoice.organization_id == org_id,
            Invoice.invoice_number.like(f"{prefix}%"),
        )
    )
    last = result.scalar_one_or_none()
    if last:
        try:
            seq = int(last.replace(prefix, "")) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


# ── Create Invoice for Payment ──────────────────────


async def create_invoice_for_payment(
    db: AsyncSession,
    payment: Payment,
    *,
    description: str = "Payment",
    subscription_id: uuid.UUID | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
) -> Invoice:
    """Create a paid invoice linked to a payment and email it to the customer.

    This is the core function that ensures no charge happens silently.
    Every successful payment gets an invoice record + email receipt.
    """
    from app.services import notification_service

    invoice_number = await _next_invoice_number(db, payment.organization_id)

    invoice = Invoice(
        organization_id=payment.organization_id,
        contact_id=payment.contact_id,
        contract_id=payment.contract_id,
        subscription_id=subscription_id,
        provider_config_id=payment.provider_config_id,
        invoice_number=invoice_number,
        status="paid",
        invoice_date=payment.payment_date,
        due_date=payment.payment_date,
        period_start=period_start,
        period_end=period_end,
        subtotal=float(payment.amount),
        tax_amount=0,
        total=float(payment.amount),
        amount_paid=float(payment.amount),
        amount_due=0,
        currency=payment.currency or "usd",
        line_items=[{
            "description": description,
            "quantity": 1,
            "unit_price": float(payment.amount),
            "amount": float(payment.amount),
        }],
        paid_at=datetime.utcnow(),
        sent_at=datetime.utcnow(),
    )
    db.add(invoice)
    await db.flush()

    # Link the payment to the invoice
    payment.invoice_id = invoice.id

    # Send receipt email to customer
    contact_result = await db.execute(
        select(Contact).where(Contact.id == payment.contact_id)
    )
    contact = contact_result.scalar_one_or_none()

    if contact and contact.email:
        method_info = ""
        if payment.payment_method_last4:
            method_info = f" (card ending {payment.payment_method_last4})"
        contact_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or "Customer"
        try:
            await notification_service.send_payment_receipt_email(
                to=contact.email,
                contact_name=contact_name,
                invoice_number=invoice_number,
                amount=float(payment.amount),
                description=description,
                payment_method=method_info,
                payment_date=str(payment.payment_date),
            )
        except Exception as e:
            logger.error(f"Failed to send receipt email for {invoice_number}: {e}")

    return invoice


# ── List ─────────────────────────────────────────────


async def list_invoices(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    status: str | None = None,
    contact_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 25,
) -> InvoiceListResponse:
    base = select(Invoice).where(Invoice.organization_id == org_id)

    if status:
        base = base.where(Invoice.status == status)
    if contact_id:
        base = base.where(Invoice.contact_id == contact_id)
    if date_from:
        base = base.where(Invoice.invoice_date >= date_from)
    if date_to:
        base = base.where(Invoice.invoice_date <= date_to)

    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    query = (
        base.order_by(Invoice.invoice_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    invoices = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return InvoiceListResponse(
        items=[InvoiceResponse.model_validate(i) for i in invoices],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_invoice(
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> Invoice:
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.organization_id == org_id,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise ValueError("Invoice not found.")
    return invoice


# ── Create ───────────────────────────────────────────


async def create_invoice(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: InvoiceCreate,
) -> Invoice:
    invoice = Invoice(
        organization_id=org_id,
        status="draft",
        amount_paid=0,
        **data.model_dump(),
    )
    db.add(invoice)
    await db.flush()
    return invoice


# ── Update ───────────────────────────────────────────


async def update_invoice(
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
) -> Invoice:
    invoice = await get_invoice(db, org_id, invoice_id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(invoice, key, value)
    invoice.updated_at = datetime.utcnow()
    await db.flush()
    return invoice


# ── Send (mark as sent) ─────────────────────────────


async def send_invoice(
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> Invoice:
    invoice = await get_invoice(db, org_id, invoice_id)

    if invoice.status not in ("draft", "sent"):
        raise ValueError(f"Cannot send invoice with status '{invoice.status}'.")

    invoice.status = "sent"
    invoice.sent_at = datetime.utcnow()
    invoice.updated_at = datetime.utcnow()
    await db.flush()

    # Send the invoice email
    contact_result = await db.execute(
        select(Contact).where(Contact.id == invoice.contact_id)
    )
    contact = contact_result.scalar_one_or_none()
    if contact and contact.email:
        from app.services import notification_service
        try:
            await notification_service.send_invoice_email(
                to=contact.email,
                invoice_number=invoice.invoice_number,
                amount=float(invoice.total),
                due_date=str(invoice.due_date),
            )
        except Exception as e:
            logger.error(f"Failed to send invoice email for {invoice.invoice_number}: {e}")

    return invoice


# ── Mark Paid ────────────────────────────────────────


async def mark_paid(
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> Invoice:
    invoice = await get_invoice(db, org_id, invoice_id)

    if invoice.status in ("paid", "void"):
        raise ValueError(f"Invoice is already '{invoice.status}'.")

    invoice.status = "paid"
    invoice.amount_paid = invoice.total
    invoice.amount_due = 0
    invoice.paid_at = datetime.utcnow()
    invoice.updated_at = datetime.utcnow()
    await db.flush()
    return invoice


# ── Void ─────────────────────────────────────────────


async def void_invoice(
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> Invoice:
    invoice = await get_invoice(db, org_id, invoice_id)

    if invoice.status == "paid":
        raise ValueError("Cannot void a paid invoice.")

    invoice.status = "void"
    invoice.voided_at = datetime.utcnow()
    invoice.updated_at = datetime.utcnow()
    await db.flush()
    return invoice


# ── Overdue Detection ────────────────────────────────


async def get_overdue_invoices(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> list[Invoice]:
    today = date.today()
    result = await db.execute(
        select(Invoice).where(
            Invoice.organization_id == org_id,
            Invoice.status.in_(["sent", "past_due"]),
            Invoice.due_date < today,
        )
    )
    return list(result.scalars().all())


async def mark_overdue_invoices(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> int:
    """Mark overdue invoices as past_due. Returns count of updated invoices."""
    invoices = await get_overdue_invoices(db, org_id)
    count = 0
    for invoice in invoices:
        if invoice.status == "sent":
            invoice.status = "past_due"
            invoice.updated_at = datetime.utcnow()
            count += 1
    await db.flush()
    return count


# ── PDF Generation (stub) ────────────────────────────


async def generate_pdf(
    db: AsyncSession,
    org_id: uuid.UUID,
    invoice_id: uuid.UUID,
) -> bytes:
    """Generate a branded PDF for the invoice. Returns PDF bytes."""
    from app.models.contact import Contact
    from app.models.organization import Organization
    from app.services.pdf_service import generate_invoice_pdf

    invoice = await get_invoice(db, org_id, invoice_id)

    # Fetch contact
    contact_result = await db.execute(
        select(Contact).where(Contact.id == invoice.contact_id, Contact.organization_id == org_id)
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

    return generate_invoice_pdf(
        org_name=org_name,
        org_address=org_address,
        contact_name=contact_name,
        contact_address=contact_address,
        invoice_number=invoice.invoice_number,
        invoice_status=invoice.status,
        invoice_date=str(invoice.invoice_date),
        due_date=str(invoice.due_date),
        line_items=invoice.line_items,
        subtotal=float(invoice.subtotal or 0),
        tax_amount=float(invoice.tax_amount or 0),
        total=float(invoice.total or 0),
        amount_paid=float(invoice.amount_paid or 0),
        amount_due=float(invoice.amount_due or 0),
        memo=invoice.memo,
    )
