import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Numeric, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

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
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id", ondelete="SET NULL")
    )
    quote_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    monthly_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=0
    )
    equipment_total: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    term_months: Mapped[int] = mapped_column(Integer, nullable=False, default=36)
    total_value: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    equipment_lines: Mapped[list | None] = mapped_column(JSONB, default=list)
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    contact: Mapped["Contact"] = relationship("Contact", lazy="selectin")
    deal: Mapped["Deal | None"] = relationship("Deal", lazy="selectin")
    quote: Mapped["Quote | None"] = relationship("Quote", lazy="selectin")
    subscription: Mapped["Subscription | None"] = relationship(
        "Subscription", back_populates="contract", lazy="selectin", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Contract {self.title}>"
