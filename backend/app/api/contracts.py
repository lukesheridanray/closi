"""
Contracts API routes -- CRUD.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthContext
from app.middleware.tenant import get_current_org_id
from app.schemas.contracts import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractListResponse,
)
from app.services import contract_service

router = APIRouter(prefix="/contracts", tags=["Contracts"])


# ── List ─────────────────────────────────────────────


@router.get("", response_model=ContractListResponse)
async def list_contracts(
    contract_status: str | None = Query(default=None, alias="status", max_length=50),
    contact_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    return await contract_service.list_contracts(
        db,
        org_id,
        status=contract_status,
        contact_id=contact_id,
        page=page,
        page_size=page_size,
    )


# ── Get ──────────────────────────────────────────────


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: uuid.UUID,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        contract = await contract_service.get_contract(db, org_id, contract_id)
        return ContractResponse.model_validate(contract)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Create ───────────────────────────────────────────


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    data: ContractCreate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        contract = await contract_service.create_contract(db, org_id, data)
        return ContractResponse.model_validate(contract)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ── Update ───────────────────────────────────────────


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: uuid.UUID,
    data: ContractUpdate,
    org_id: uuid.UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        contract = await contract_service.update_contract(db, org_id, contract_id, data)
        return ContractResponse.model_validate(contract)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
