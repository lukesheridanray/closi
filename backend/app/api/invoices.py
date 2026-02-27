"""
Invoices API routes -- CRUD, send, mark paid, void, PDF.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthContext
from app.middleware.tenant import get_current_org_id
from app.schemas.invoices import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceListResponse,
)
from app.schemas.auth import MessageResponse
from app.services import invoice_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    invoice_status: str | None = Query(default=None, alias="status", max_length=50),
    contact_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await invoice_service.list_invoices(
        db,
        org_id,
        status=invoice_status,
        contact_id=contact_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


# ── Get ──────────────────────────────────────────────


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await invoice_service.get_invoice(db, org_id, invoice_id)
        return InvoiceResponse.model_validate(invoice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Create ───────────────────────────────────────────


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await invoice_service.create_invoice(db, org_id, data)
        return InvoiceResponse.model_validate(invoice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await invoice_service.update_invoice(db, org_id, invoice_id, data)
        return InvoiceResponse.model_validate(invoice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Send ─────────────────────────────────────────────


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await invoice_service.send_invoice(db, org_id, invoice_id)
        return InvoiceResponse.model_validate(invoice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Mark Paid ────────────────────────────────────────


@router.patch("/{invoice_id}/mark-paid", response_model=InvoiceResponse)
async def mark_paid(
    invoice_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await invoice_service.mark_paid(db, org_id, invoice_id)
        return InvoiceResponse.model_validate(invoice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Void ─────────────────────────────────────────────


@router.patch("/{invoice_id}/void", response_model=InvoiceResponse)
async def void_invoice(
    invoice_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        invoice = await invoice_service.void_invoice(db, org_id, invoice_id)
        return InvoiceResponse.model_validate(invoice)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── PDF ──────────────────────────────────────────────


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        pdf_bytes = await invoice_service.generate_pdf(db, org_id, invoice_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=invoice-{invoice_id}.pdf"
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
