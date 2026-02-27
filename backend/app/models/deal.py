import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Deal(Base):
    __tablename__ = "deals"

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
    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_stages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_value: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    notes: Mapped[str | None] = mapped_column(Text)
    loss_reason: Mapped[str | None] = mapped_column(Text)
    expected_close_date: Mapped[datetime | None] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    contact: Mapped["Contact"] = relationship(
        "Contact", back_populates="deals", lazy="selectin"
    )
    pipeline: Mapped["Pipeline"] = relationship("Pipeline", lazy="selectin")
    stage: Mapped["PipelineStage | None"] = relationship(
        "PipelineStage", lazy="selectin"
    )
    assigned_user: Mapped["User | None"] = relationship(
        "User", lazy="selectin", foreign_keys=[assigned_to]
    )
    stage_history: Mapped[list["StageHistory"]] = relationship(
        "StageHistory", back_populates="deal", lazy="selectin",
        order_by="StageHistory.moved_at.desc()"
    )
    quotes: Mapped[list["Quote"]] = relationship(
        "Quote", back_populates="deal", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Deal {self.title}>"
