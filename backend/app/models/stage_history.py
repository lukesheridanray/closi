import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StageHistory(Base):
    __tablename__ = "stage_history"

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
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL")
    )
    to_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    moved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    moved_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    deal: Mapped["Deal"] = relationship(
        "Deal", back_populates="stage_history", lazy="selectin"
    )
    from_stage: Mapped["PipelineStage | None"] = relationship(
        "PipelineStage", lazy="selectin", foreign_keys=[from_stage_id]
    )
    to_stage: Mapped["PipelineStage | None"] = relationship(
        "PipelineStage", lazy="selectin", foreign_keys=[to_stage_id]
    )
    moved_by_user: Mapped["User | None"] = relationship(
        "User", lazy="selectin", foreign_keys=[moved_by]
    )

    def __repr__(self) -> str:
        return f"<StageHistory deal={self.deal_id}>"
