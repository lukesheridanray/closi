"""
Quotes API routes -- CRUD, accept/convert, PDF generation, customer response links.
"""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, HTMLResponse
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
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


# ── Delete ───────────────────────────────────────────


@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await quote_service.get_quote(db, org_id, quote_id)
        await db.delete(quote)
        return {"status": "deleted"}
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


# ── Send ─────────────────────────────────────────────


@router.post("/{quote_id}/send", response_model=QuoteResponse)
async def send_quote(
    quote_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await quote_service.send_quote(db, org_id, quote_id)
        return QuoteResponse.model_validate(quote)
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


# ── Customer Response (public, token-authenticated) ──


_settings = get_settings()


def _generate_quote_token(quote_id: uuid.UUID, org_id: uuid.UUID) -> str:
    payload = {
        "quote_id": str(quote_id),
        "org_id": str(org_id),
        "exp": datetime.utcnow() + timedelta(days=30),
    }
    return jwt.encode(payload, _settings.secret_key, algorithm=_settings.algorithm)


def _verify_quote_token(token: str) -> dict:
    try:
        return jwt.decode(token, _settings.secret_key, algorithms=[_settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link.")


def get_quote_response_url(quote_id: uuid.UUID, org_id: uuid.UUID, action: str) -> str:
    token = _generate_quote_token(quote_id, org_id)
    base = _settings.app_base_url.rstrip("/")
    return f"{base}/api/v1/quotes/respond?token={token}&action={action}"


@router.get("/respond", response_class=HTMLResponse)
async def customer_quote_response(
    token: str = Query(...),
    action: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for customers to accept or decline a quote from email."""
    from app.models.quote import Quote
    from app.models.activity import Activity
    from app.models.organization import Organization
    from sqlalchemy import select

    payload = _verify_quote_token(token)
    quote_id = uuid.UUID(payload["quote_id"])
    org_id = uuid.UUID(payload["org_id"])

    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.organization_id == org_id)
    )
    quote = result.scalar_one_or_none()
    if not quote:
        return HTMLResponse("<h1>Quote not found</h1>", status_code=404)

    if action == "accept":
        if quote.status == "accepted":
            message = "This quote has already been accepted. Thank you!"
        elif quote.status == "rejected":
            message = "This quote was previously declined."
        else:
            quote.status = "accepted"
            quote.accepted_at = datetime.utcnow()
            quote.updated_at = datetime.utcnow()
            activity = Activity(
                organization_id=org_id,
                contact_id=quote.contact_id,
                type="quote_sent",
                subject=f"Quote accepted by customer: {quote.title}",
                description="Customer accepted via email link.",
                performed_at=datetime.utcnow(),
            )
            db.add(activity)
            await db.commit()
            message = "Quote accepted! Thank you. We will be in touch shortly to schedule your installation."

    elif action == "decline":
        if quote.status == "rejected":
            message = "This quote has already been declined."
        elif quote.status == "accepted":
            message = "This quote was already accepted."
        else:
            quote.status = "rejected"
            quote.updated_at = datetime.utcnow()
            activity = Activity(
                organization_id=org_id,
                contact_id=quote.contact_id,
                type="quote_sent",
                subject=f"Quote declined by customer: {quote.title}",
                description="Customer declined via email link.",
                performed_at=datetime.utcnow(),
            )
            db.add(activity)
            await db.commit()
            message = "Quote declined. If you change your mind or have questions, please don't hesitate to reach out."
    else:
        message = "Invalid action."

    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else ""

    return HTMLResponse(f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{org_name}</title>
<style>body{{font-family:Inter,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb}}.card{{background:white;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}}h1{{color:#6C63FF;font-size:20px;margin-bottom:12px}}p{{color:#6b7280;font-size:15px;line-height:1.6}}</style>
</head><body><div class="card"><h1>{org_name}</h1><p>{message}</p></div></body></html>""")
