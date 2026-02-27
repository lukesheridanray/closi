import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    equipment_total: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    monthly_monitoring_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=0
    )
    contract_term_months: Mapped[int] = mapped_column(Integer, nullable=False, default=36)
    auto_renewal: Mapped[bool] = mapped_column(Boolean, default=True)
    total_contract_value: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    equipment_lines: Mapped[list | None] = mapped_column(JSONB, default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
    pdf_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    deal: Mapped["Deal"] = relationship(
        "Deal", back_populates="quotes", lazy="selectin"
    )
    contact: Mapped["Contact"] = relationship("Contact", lazy="selectin")
    created_by_user: Mapped["User | None"] = relationship(
        "User", lazy="selectin", foreign_keys=[created_by]
    )

    def __repr__(self) -> str:
        return f"<Quote {self.title}>"
