import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import PaginationMeta


class BillingAccountRow(BaseModel):
    contact_id: uuid.UUID
    customer_name: str
    company: str | None
    email: str | None
    phone: str | None
    lead_source: str
    contact_status: str
    contract_id: uuid.UUID | None
    contract_title: str | None
    contract_status: str | None
    has_billing_profile: bool
    has_card_on_file: bool
    payment_method_type: str | None
    payment_method_last4: str | None
    payment_method_brand: str | None
    monthly_amount: float | None
    subscription_status: str | None
    next_billing_date: date | None
    last_payment_date: date | None
    last_payment_amount: float | None
    last_payment_status: str | None
    failed_payment_count: int
    billing_flag: str
    outstanding_balance: float
    lifetime_revenue: float
    updated_at: datetime


class BillingAccountListResponse(BaseModel):
    items: list[BillingAccountRow]
    meta: PaginationMeta
    total_mrr: float
    past_due_count: int
    missing_card_count: int
