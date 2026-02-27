import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PaymentProviderConfig(Base):
    __tablename__ = "payment_provider_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    credentials: Mapped[dict | None] = mapped_column(JSONB)
    environment: Mapped[str] = mapped_column(String(20), nullable=False, default="sandbox")
    settings: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    auto_invoice: Mapped[bool] = mapped_column(Boolean, default=False)
    retry_failed_days: Mapped[int] = mapped_column(Integer, default=14)
    retry_max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<PaymentProviderConfig {self.display_name}>"


class CustomerPaymentProfile(Base):
    __tablename__ = "customer_payment_profiles"

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
    provider_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_provider_configs.id", ondelete="CASCADE"),
        nullable=False,
    )
    external_customer_id: Mapped[str | None] = mapped_column(String(255))
    external_payment_id: Mapped[str | None] = mapped_column(String(255))
    payment_method_type: Mapped[str | None] = mapped_column(String(50))
    payment_method_last4: Mapped[str | None] = mapped_column(String(4))
    payment_method_brand: Mapped[str | None] = mapped_column(String(50))
    payment_method_exp_month: Mapped[int | None] = mapped_column(Integer)
    payment_method_exp_year: Mapped[int | None] = mapped_column(Integer)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<CustomerPaymentProfile contact={self.contact_id}>"


class PaymentWebhookLog(Base):
    __tablename__ = "payment_webhook_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payment_provider_configs.id", ondelete="CASCADE"),
        nullable=False,
    )
    external_event_id: Mapped[str | None] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    processing_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="received"
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<PaymentWebhookLog {self.event_type}>"
