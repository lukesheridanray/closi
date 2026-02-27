import uuid
from datetime import datetime, date

from sqlalchemy import String, DateTime, Date, Numeric, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="SET NULL")
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL")
    )
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL")
    )
    provider_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_provider_configs.id", ondelete="SET NULL"),
    )
    external_payment_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    amount_refunded: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="usd")
    payment_method_type: Mapped[str | None] = mapped_column(String(50))
    payment_method_last4: Mapped[str | None] = mapped_column(String(4))
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    failure_code: Mapped[str | None] = mapped_column(String(100))
    failure_message: Mapped[str | None] = mapped_column(Text)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    contact: Mapped["Contact"] = relationship("Contact", lazy="selectin")
    contract: Mapped["Contract | None"] = relationship("Contract", lazy="selectin")
    subscription: Mapped["Subscription | None"] = relationship(
        "Subscription", lazy="selectin"
    )
    invoice: Mapped["Invoice | None"] = relationship(
        "Invoice", back_populates="payments", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Payment {self.amount} {self.status}>"
