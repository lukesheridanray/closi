import math
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.contract import Contract
from app.models.payment import Payment
from app.models.payment_provider import CustomerPaymentProfile
from app.models.subscription import Subscription
from app.schemas.billing import BillingAccountListResponse, BillingAccountRow
from app.schemas.common import PaginationMeta


async def list_billing_accounts(
    db: AsyncSession,
    org_id: uuid.UUID,
    search: str | None = None,
    billing_flag: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> BillingAccountListResponse:
    filters = [Contact.organization_id == org_id, Contact.is_deleted == False]
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.company.ilike(term),
                Contact.email.ilike(term),
                Contact.phone.ilike(term),
            )
        )

    total_count = await db.scalar(select(func.count()).select_from(Contact).where(*filters)) or 0

    contacts_result = await db.execute(
        select(Contact)
        .where(*filters)
        .order_by(Contact.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    contacts = list(contacts_result.scalars().all())
    if not contacts:
        return BillingAccountListResponse(
            items=[],
            meta=PaginationMeta(page=page, page_size=page_size, total_count=0, total_pages=0),
            total_mrr=0,
            past_due_count=0,
            missing_card_count=0,
        )

    contact_ids = [contact.id for contact in contacts]
    profile_map = await _load_profile_map(db, org_id, contact_ids)
    contract_map = await _load_contract_map(db, org_id, contact_ids)
    subscription_map = await _load_subscription_map(db, org_id, contact_ids)
    payment_map = await _load_payment_map(db, org_id, contact_ids)

    items: list[BillingAccountRow] = []
    for contact in contacts:
        profile = profile_map.get(contact.id)
        contract = contract_map.get(contact.id)
        subscription = subscription_map.get(contact.id)
        payment_summary = payment_map.get(contact.id, {})
        row = _build_billing_row(contact, profile, contract, subscription, payment_summary)
        if billing_flag and row.billing_flag != billing_flag:
            continue
        items.append(row)

    total_pages = math.ceil(total_count / page_size) if total_count else 0
    return BillingAccountListResponse(
        items=items,
        meta=PaginationMeta(page=page, page_size=page_size, total_count=total_count, total_pages=total_pages),
        total_mrr=sum(item.monthly_amount or 0 for item in items if item.subscription_status in {"active", "past_due"}),
        past_due_count=sum(1 for item in items if item.billing_flag == "past_due"),
        missing_card_count=sum(1 for item in items if item.billing_flag == "no_card"),
    )


async def _load_profile_map(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
) -> dict[uuid.UUID, CustomerPaymentProfile]:
    result = await db.execute(
        select(CustomerPaymentProfile).where(
            CustomerPaymentProfile.organization_id == org_id,
            CustomerPaymentProfile.contact_id.in_(contact_ids),
        )
    )
    return {profile.contact_id: profile for profile in result.scalars().all()}


async def _load_contract_map(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Contract]:
    result = await db.execute(
        select(Contract)
        .where(
            Contract.organization_id == org_id,
            Contract.contact_id.in_(contact_ids),
        )
        .order_by(Contract.updated_at.desc())
    )

    contract_map: dict[uuid.UUID, Contract] = {}
    for contract in result.scalars().all():
        existing = contract_map.get(contract.contact_id)
        if existing is None or _contract_priority(contract) > _contract_priority(existing):
            contract_map[contract.contact_id] = contract
    return contract_map


async def _load_subscription_map(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Subscription]:
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.organization_id == org_id,
            Subscription.contact_id.in_(contact_ids),
        )
        .order_by(Subscription.updated_at.desc())
    )

    subscription_map: dict[uuid.UUID, Subscription] = {}
    for subscription in result.scalars().all():
        existing = subscription_map.get(subscription.contact_id)
        if existing is None or _subscription_priority(subscription) > _subscription_priority(existing):
            subscription_map[subscription.contact_id] = subscription
    return subscription_map


async def _load_payment_map(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
) -> dict[uuid.UUID, dict]:
    result = await db.execute(
        select(Payment)
        .where(
            Payment.organization_id == org_id,
            Payment.contact_id.in_(contact_ids),
        )
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
    )

    payment_map: dict[uuid.UUID, dict] = {}
    for payment in result.scalars().all():
        summary = payment_map.setdefault(
            payment.contact_id,
            {
                "last_payment": None,
                "lifetime_revenue": 0.0,
                "outstanding_balance": 0.0,
                "failed_payment_count": 0,
            },
        )
        if summary["last_payment"] is None:
            summary["last_payment"] = payment
        if payment.status == "succeeded":
            summary["lifetime_revenue"] += float(payment.amount)
        elif payment.status == "failed":
            summary["failed_payment_count"] += 1
            summary["outstanding_balance"] += float(payment.amount)
    return payment_map


def _build_billing_row(
    contact: Contact,
    profile: CustomerPaymentProfile | None,
    contract: Contract | None,
    subscription: Subscription | None,
    payment_summary: dict,
) -> BillingAccountRow:
    last_payment = payment_summary.get("last_payment")
    failed_payment_count = payment_summary.get("failed_payment_count", 0)
    has_billing_profile = bool(profile and profile.external_customer_id)
    has_card_on_file = bool(profile and profile.external_payment_id)

    if subscription and subscription.status == "past_due":
        flag = "past_due"
    elif subscription and subscription.status == "cancelled":
        flag = "cancelled"
    elif has_billing_profile and not has_card_on_file:
        flag = "no_card"
    elif not has_billing_profile:
        flag = "not_started"
    elif failed_payment_count > 0:
        flag = "attention"
    elif subscription and subscription.status == "active":
        flag = "current"
    else:
        flag = "ready"

    return BillingAccountRow(
        contact_id=contact.id,
        customer_name=f"{contact.first_name} {contact.last_name}".strip(),
        company=contact.company,
        email=contact.email,
        phone=contact.phone,
        lead_source=contact.lead_source,
        contact_status=contact.status,
        contract_id=contract.id if contract else None,
        contract_title=contract.title if contract else None,
        contract_status=contract.status if contract else None,
        has_billing_profile=has_billing_profile,
        has_card_on_file=has_card_on_file,
        payment_method_type=profile.payment_method_type if profile else None,
        payment_method_last4=profile.payment_method_last4 if profile else None,
        payment_method_brand=profile.payment_method_brand if profile else None,
        monthly_amount=float(subscription.amount) if subscription else (float(contract.monthly_amount) if contract else None),
        subscription_status=subscription.status if subscription else None,
        next_billing_date=subscription.next_billing_date if subscription else None,
        last_payment_date=last_payment.payment_date if last_payment else None,
        last_payment_amount=float(last_payment.amount) if last_payment else None,
        last_payment_status=last_payment.status if last_payment else None,
        failed_payment_count=failed_payment_count,
        billing_flag=flag,
        outstanding_balance=payment_summary.get("outstanding_balance", 0.0),
        lifetime_revenue=payment_summary.get("lifetime_revenue", 0.0),
        updated_at=max(
            contact.updated_at,
            profile.updated_at if profile else contact.updated_at,
            contract.updated_at if contract else contact.updated_at,
            subscription.updated_at if subscription else contact.updated_at,
        ),
    )


def _contract_priority(contract: Contract) -> tuple[int, object]:
    status_rank = {"active": 3, "pending": 2, "expired": 1, "cancelled": 0}
    return (status_rank.get(contract.status, 0), contract.updated_at)


def _subscription_priority(subscription: Subscription) -> tuple[int, object]:
    status_rank = {"past_due": 4, "active": 3, "paused": 2, "expired": 1, "cancelled": 0}
    return (status_rank.get(subscription.status, 0), subscription.updated_at)
