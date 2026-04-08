"""
Celery tasks for billing automation:
- Daily reconciliation against Authorize.net
- Monthly subscription invoice generation
- Overdue invoice detection
"""

import asyncio
import logging
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from celery_app import celery
from app.config import get_settings

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async function from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_session() -> async_sessionmaker[AsyncSession]:
    """Create a fresh async session factory for this task invocation.

    Each Celery task gets its own engine+session so we don't share
    asyncio event loop state with the web process.
    """
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Daily Reconciliation ────────────────────────────


@celery.task(name="billing.daily_reconciliation", bind=True, max_retries=2)
def daily_reconciliation(self):
    """Reconcile the last 3 days of transactions against Authorize.net.

    Runs daily. Overlaps by 3 days to catch settlement delays.
    """
    _run_async(_daily_reconciliation_async())


async def _daily_reconciliation_async():
    from app.integrations import authnet_service
    from app.models.payment_provider import PaymentProviderConfig
    from sqlalchemy import select

    session_factory = _make_session()
    async with session_factory() as db:
        # Find all orgs with active authnet configs
        result = await db.execute(
            select(PaymentProviderConfig).where(
                PaymentProviderConfig.provider_type == "authorize_net",
                PaymentProviderConfig.is_active.is_(True),
            )
        )
        configs = result.scalars().all()

        for config in configs:
            org_id = config.organization_id
            try:
                report = await authnet_service.reconcile_transactions(
                    db, org_id,
                    date_from=date.today() - timedelta(days=3),
                    date_to=date.today(),
                )
                await db.commit()
                if report["corrections_applied"] > 0:
                    logger.warning(
                        f"Reconciliation for org {org_id}: "
                        f"{report['corrections_applied']} corrections applied, "
                        f"{len(report['mismatches'])} mismatches found"
                    )
                else:
                    logger.info(f"Reconciliation for org {org_id}: all matched")
            except Exception as e:
                await db.rollback()
                logger.error(f"Reconciliation failed for org {org_id}: {e}")


# ── Monthly Subscription Billing ────────────────────


@celery.task(name="billing.process_subscription_invoices", bind=True, max_retries=2)
def process_subscription_invoices(self):
    """Generate invoices for subscriptions whose billing date has passed.

    ARB handles the actual charge at Authorize.net. This task ensures
    every charge cycle has a corresponding invoice in the CRM.
    If a webhook already created the Payment, we just attach the invoice.
    If no Payment exists yet, we flag it for reconciliation.
    """
    _run_async(_process_subscription_invoices_async())


async def _process_subscription_invoices_async():
    from app.models.subscription import Subscription
    from app.models.payment import Payment
    from app.models.activity import Activity
    from app.models.task import Task
    from app.services.invoice_service import create_invoice_for_payment
    from sqlalchemy import select
    from datetime import datetime
    from dateutil.relativedelta import relativedelta

    session_factory = _make_session()
    async with session_factory() as db:
        # Find active subscriptions where next_billing_date <= today
        result = await db.execute(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.next_billing_date.isnot(None),
                Subscription.next_billing_date <= date.today(),
            )
        )
        due_subs = result.scalars().all()

        for sub in due_subs:
            try:
                period_start = sub.current_period_start or sub.next_billing_date
                period_end = period_start + relativedelta(months=sub.billing_interval_count) - timedelta(days=1)

                # Check if a payment already exists for this period
                # (created by webhook or charge_customer)
                # Try matching by subscription_id first, fall back to amount+date match
                existing_payment = await db.execute(
                    select(Payment).where(
                        Payment.organization_id == sub.organization_id,
                        Payment.contact_id == sub.contact_id,
                        Payment.status == "succeeded",
                        Payment.payment_date >= period_start,
                        Payment.payment_date <= date.today(),
                        Payment.subscription_id == sub.id,
                    ).order_by(Payment.created_at.desc())
                )
                if not existing_payment.scalar_one_or_none():
                    # Fallback: match by amount (for ARB webhooks that don't set subscription_id)
                    existing_payment = await db.execute(
                        select(Payment).where(
                            Payment.organization_id == sub.organization_id,
                            Payment.contact_id == sub.contact_id,
                            Payment.status == "succeeded",
                            Payment.payment_date >= period_start,
                            Payment.payment_date <= date.today(),
                            Payment.amount == sub.amount,
                            Payment.subscription_id.is_(None),
                        ).order_by(Payment.created_at.desc())
                    )
                payment = existing_payment.scalar_one_or_none()

                if payment and not payment.invoice_id:
                    # Payment exists but no invoice — generate one
                    await create_invoice_for_payment(
                        db, payment,
                        description=f"Monthly monitoring ({period_start.strftime('%b %Y')})",
                        subscription_id=sub.id,
                        period_start=period_start,
                        period_end=period_end,
                    )
                    logger.info(f"Invoice created for subscription {sub.id}, payment {payment.id}")
                elif payment and payment.invoice_id:
                    # Already invoiced — nothing to do
                    logger.info(f"Subscription {sub.id} already invoiced for this period")
                else:
                    # No payment found — ARB may not have fired yet, or webhook missed
                    if sub.next_billing_date and (date.today() - sub.next_billing_date).days > 2:
                        # Past grace period — create follow-up task and advance
                        task = Task(
                            organization_id=sub.organization_id,
                            contact_id=sub.contact_id,
                            title=f"Missing payment for {period_start.strftime('%b %Y')} monitoring",
                            description=(
                                f"Subscription {sub.id} was due on {sub.next_billing_date} "
                                f"but no payment has been recorded. "
                                f"Check Authorize.net ARB status or run reconciliation."
                            ),
                            type="follow_up",
                            priority="high",
                            status="pending",
                        )
                        db.add(task)
                        logger.warning(f"No payment found for subscription {sub.id}, task created")
                    else:
                        # Within grace period — don't advance yet, wait for ARB/webhook
                        logger.info(f"Subscription {sub.id} due but within grace period, skipping")
                        continue

                # Advance billing dates (only reached when payment found or grace period exceeded)
                next_date = sub.next_billing_date + relativedelta(months=sub.billing_interval_count)
                sub.current_period_start = period_start
                sub.current_period_end = period_end
                sub.next_billing_date = next_date
                sub.updated_at = datetime.utcnow()

                await db.commit()

            except Exception as e:
                await db.rollback()
                logger.error(f"Failed to process subscription {sub.id}: {e}")


# ── Overdue Invoice Detection ───────────────────────


@celery.task(name="billing.mark_overdue_invoices", bind=True)
def mark_overdue_invoices(self):
    """Mark sent invoices as past_due if their due date has passed."""
    _run_async(_mark_overdue_invoices_async())


async def _mark_overdue_invoices_async():
    from app.models.organization import Organization
    from app.services import invoice_service
    from sqlalchemy import select

    session_factory = _make_session()
    async with session_factory() as db:
        result = await db.execute(
            select(Organization.id).where(Organization.is_active.is_(True))
        )
        org_ids = [row[0] for row in result.all()]

        for org_id in org_ids:
            try:
                count = await invoice_service.mark_overdue_invoices(db, org_id)
                await db.commit()
                if count > 0:
                    logger.info(f"Marked {count} invoices overdue for org {org_id}")
            except Exception as e:
                await db.rollback()
                logger.error(f"Failed to mark overdue invoices for org {org_id}: {e}")
