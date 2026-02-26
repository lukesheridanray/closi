"""
Tenant-scoping dependency.

Extracts the current organization ID from the authenticated user's JWT
context.  Use this to scope all database queries by organization so that
tenants can never see each other's data.

Usage::

    @router.get("/things")
    async def list_things(
        org_id: uuid.UUID = Depends(get_current_org_id),
        db: AsyncSession = Depends(get_db),
    ):
        ...
"""

import uuid
from typing import Annotated

from fastapi import Depends

from app.middleware.auth import AuthContext, get_current_user


async def get_current_org_id(
    auth: Annotated[AuthContext, Depends(get_current_user)],
) -> uuid.UUID:
    """Return the authenticated user's organization ID."""
    return auth.org_id
