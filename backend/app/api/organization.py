"""
Organization API routes -- Get and update org settings.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, require_roles, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.organization import OrganizationUpdate, OrganizationResponse
from app.services import organization_service

router = APIRouter(prefix="/organization", tags=["Organization"])


# ── Get ──────────────────────────────────────────────


@router.get("", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        org = await organization_service.get_organization(db, org_id)
        return OrganizationResponse.model_validate(org)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("", response_model=OrganizationResponse)
async def update_organization(
    data: OrganizationUpdate,
    auth: AuthContext = Depends(require_roles("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        org = await organization_service.update_organization(db, auth.org_id, data)
        return OrganizationResponse.model_validate(org)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
