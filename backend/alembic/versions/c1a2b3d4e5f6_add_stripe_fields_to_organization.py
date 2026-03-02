"""add stripe fields to organization

Revision ID: c1a2b3d4e5f6
Revises: b48584ef1dcc
Create Date: 2026-02-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: str = "b48584ef1dcc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("stripe_account_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("stripe_connected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "organizations",
        sa.Column("stripe_onboarding_complete", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("organizations", "stripe_onboarding_complete")
    op.drop_column("organizations", "stripe_connected")
    op.drop_column("organizations", "stripe_account_id")
