"""
Contacts API routes -- CRUD, CSV import, import templates.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.contacts import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactListResponse,
    CSVImportRequest,
    CSVImportResponse,
    ImportTemplateCreate,
    ImportTemplateResponse,
)
from app.schemas.auth import MessageResponse
from app.services import contact_service

router = APIRouter(prefix="/contacts", tags=["Contacts"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    search: str | None = Query(default=None, max_length=200),
    lead_source: str | None = Query(default=None, max_length=50),
    contact_status: str | None = Query(default=None, alias="status", max_length=50),
    sort_by: str = Query(default="created_at", max_length=50),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await contact_service.list_contacts(
        db,
        org_id,
        search=search,
        lead_source=lead_source,
        status=contact_status,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )


# ── Get ──────────────────────────────────────────────


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        contact = await contact_service.get_contact(db, org_id, contact_id)
        return ContactResponse.model_validate(contact)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Create ───────────────────────────────────────────


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        contact = await contact_service.create_contact(db, org_id, data)
        return ContactResponse.model_validate(contact)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    data: ContactUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        contact = await contact_service.update_contact(db, org_id, contact_id, data)
        return ContactResponse.model_validate(contact)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Delete ───────────────────────────────────────────


@router.delete("/{contact_id}", response_model=MessageResponse)
async def delete_contact(
    contact_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await contact_service.delete_contact(db, org_id, contact_id)
        return MessageResponse(message="Contact deleted.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── CSV Import ───────────────────────────────────────


@router.post("/import", response_model=CSVImportResponse)
async def import_contacts(
    data: CSVImportRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await contact_service.import_contacts(db, auth.org_id, auth.user_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Import Templates ─────────────────────────────────


@router.get("/import/templates", response_model=list[ImportTemplateResponse])
async def list_import_templates(
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await contact_service.list_import_templates(db, org_id)


@router.post(
    "/import/templates",
    response_model=ImportTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_import_template(
    data: ImportTemplateCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await contact_service.create_import_template(
            db, auth.org_id, auth.user_id, data
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/import/templates/{template_id}", response_model=MessageResponse)
async def delete_import_template(
    template_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await contact_service.delete_import_template(db, org_id, template_id)
        return MessageResponse(message="Import template deleted.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
