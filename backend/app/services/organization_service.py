"""
Organization service -- Org settings.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.schemas.organization import OrganizationUpdate, OrganizationResponse


# ── Get ──────────────────────────────────────────────


async def get_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> Organization:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise ValueError("Organization not found.")
    return org


# ── Update ───────────────────────────────────────────


async def update_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: OrganizationUpdate,
) -> Organization:
    org = await get_organization(db, org_id)
    updates = data.model_dump(exclude_unset=True)

    # Deep-merge settings to avoid clobbering other keys
    if "settings" in updates and updates["settings"] is not None:
        current = dict(org.settings) if org.settings else {}
        for k, v in updates["settings"].items():
            if isinstance(v, dict) and isinstance(current.get(k), dict):
                current[k] = {**current[k], **v}
            else:
                current[k] = v
        updates["settings"] = current

    for key, value in updates.items():
        setattr(org, key, value)
    org.updated_at = datetime.utcnow()
    await db.flush()
    return org
