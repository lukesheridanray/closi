"""
Quotes API routes -- CRUD, accept/convert, PDF generation.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import AuthContext, get_current_user
from app.middleware.tenant import get_current_org_id
from app.schemas.quotes import (
    QuoteCreate,
    QuoteUpdate,
    QuoteResponse,
    QuoteListResponse,
)
from app.schemas.contracts import ContractResponse
from app.services import quote_service

router = APIRouter(prefix="/quotes", tags=["Quotes"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=QuoteListResponse)
async def list_quotes(
    deal_id: uuid.UUID | None = Query(default=None),
    contact_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await quote_service.list_quotes(
        db,
        org_id,
        deal_id=deal_id,
        contact_id=contact_id,
        page=page,
        page_size=page_size,
    )


# ── Get ──────────────────────────────────────────────


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await quote_service.get_quote(db, org_id, quote_id)
        return QuoteResponse.model_validate(quote)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Create ───────────────────────────────────────────


@router.post("", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    data: QuoteCreate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await quote_service.create_quote(db, auth.org_id, auth.user_id, data)
        return QuoteResponse.model_validate(quote)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: uuid.UUID,
    data: QuoteUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await quote_service.update_quote(db, org_id, quote_id, data)
        return QuoteResponse.model_validate(quote)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Accept (Convert to Contract) ─────────────────────


@router.post("/{quote_id}/accept", response_model=ContractResponse)
async def accept_quote(
    quote_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        contract = await quote_service.accept_quote(db, auth.org_id, quote_id, auth.user_id)
        return ContractResponse.model_validate(contract)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── PDF ──────────────────────────────────────────────


@router.get("/{quote_id}/pdf")
async def get_quote_pdf(
    quote_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        pdf_bytes = await quote_service.generate_pdf(db, org_id, quote_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=quote-{quote_id}.pdf"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
