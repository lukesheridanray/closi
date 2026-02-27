"""
Contact service -- CRUD, deduplication, CSV import with scrubbing.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.import_template import ImportTemplate
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
from app.schemas.common import PaginationMeta


# ── List ─────────────────────────────────────────────


async def list_contacts(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    search: str | None = None,
    lead_source: str | None = None,
    status: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> ContactListResponse:
    base = select(Contact).where(
        Contact.organization_id == org_id,
        Contact.is_deleted == False,  # noqa: E712
    )

    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.email.ilike(term),
                Contact.phone.ilike(term),
                Contact.company.ilike(term),
            )
        )

    if lead_source:
        base = base.where(Contact.lead_source == lead_source)
    if status:
        base = base.where(Contact.status == status)

    # Total count
    count_q = select(func.count()).select_from(base.subquery())
    total_count = (await db.execute(count_q)).scalar_one()

    # Sort
    allowed_sort = {
        "created_at": Contact.created_at,
        "first_name": Contact.first_name,
        "last_name": Contact.last_name,
        "email": Contact.email,
        "company": Contact.company,
    }
    sort_col = allowed_sort.get(sort_by, Contact.created_at)
    order = sort_col.desc() if sort_dir == "desc" else sort_col.asc()

    query = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    contacts = result.scalars().all()

    total_pages = max(1, (total_count + page_size - 1) // page_size)

    return ContactListResponse(
        items=[ContactResponse.model_validate(c) for c in contacts],
        meta=PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        ),
    )


# ── Get ──────────────────────────────────────────────


async def get_contact(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> Contact:
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == org_id,
            Contact.is_deleted == False,  # noqa: E712
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise ValueError("Contact not found.")
    return contact


# ── Create ───────────────────────────────────────────


async def create_contact(
    db: AsyncSession,
    org_id: uuid.UUID,
    data: ContactCreate,
) -> Contact:
    contact = Contact(
        organization_id=org_id,
        **data.model_dump(),
    )
    db.add(contact)
    await db.flush()
    return contact


# ── Update ───────────────────────────────────────────


async def update_contact(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
    data: ContactUpdate,
) -> Contact:
    contact = await get_contact(db, org_id, contact_id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(contact, key, value)
    contact.updated_at = datetime.utcnow()
    await db.flush()
    return contact


# ── Soft Delete ──────────────────────────────────────


async def delete_contact(
    db: AsyncSession,
    org_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> None:
    contact = await get_contact(db, org_id, contact_id)
    contact.is_deleted = True
    contact.updated_at = datetime.utcnow()
    await db.flush()


# ── CSV Import ───────────────────────────────────────


async def import_contacts(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: CSVImportRequest,
) -> CSVImportResponse:
    """Bulk import contacts with duplicate handling."""
    imported = 0
    updated = 0
    skipped = 0
    failed = 0
    failed_rows: list[dict] = []

    # Pre-load existing contacts for dedup (email + phone)
    existing_result = await db.execute(
        select(Contact).where(
            Contact.organization_id == org_id,
            Contact.is_deleted == False,  # noqa: E712
        )
    )
    existing = existing_result.scalars().all()

    email_map: dict[str, Contact] = {}
    phone_map: dict[str, Contact] = {}
    for c in existing:
        if c.email:
            email_map[c.email.lower()] = c
        if c.phone:
            phone_map[_digits(c.phone)] = c

    for idx, contact_data in enumerate(data.contacts):
        try:
            # Find duplicate
            dup = _find_duplicate(contact_data, email_map, phone_map)

            if dup:
                if data.duplicate_action == "skip":
                    skipped += 1
                    continue
                elif data.duplicate_action == "update":
                    updates = contact_data.model_dump(exclude_unset=True)
                    if data.lead_source_override:
                        updates["lead_source"] = data.lead_source_override
                    if data.assigned_to_override:
                        updates["assigned_to"] = data.assigned_to_override
                    for key, value in updates.items():
                        if value is not None:
                            setattr(dup, key, value)
                    dup.updated_at = datetime.utcnow()
                    updated += 1
                    continue
                # else "create" -- fall through to create new

            # Create new contact
            row = contact_data.model_dump()
            if data.lead_source_override:
                row["lead_source"] = data.lead_source_override
            if data.assigned_to_override:
                row["assigned_to"] = data.assigned_to_override

            contact = Contact(organization_id=org_id, **row)
            db.add(contact)
            imported += 1

            # Update dedup maps
            if contact_data.email:
                email_map[contact_data.email.lower()] = contact
            if contact_data.phone:
                phone_map[_digits(contact_data.phone)] = contact

        except Exception:
            failed += 1
            failed_rows.append({"row": idx + 1, **contact_data.model_dump()})

    await db.flush()

    return CSVImportResponse(
        imported=imported,
        updated=updated,
        skipped=skipped,
        failed=failed,
        failed_rows=failed_rows,
    )


def _digits(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())


def _find_duplicate(
    data: ContactCreate,
    email_map: dict[str, "Contact"],
    phone_map: dict[str, "Contact"],
) -> Contact | None:
    if data.email and data.email.lower() in email_map:
        return email_map[data.email.lower()]
    if data.phone and _digits(data.phone) in phone_map:
        return phone_map[_digits(data.phone)]
    return None


# ── Import Templates ─────────────────────────────────


async def list_import_templates(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> list[ImportTemplateResponse]:
    result = await db.execute(
        select(ImportTemplate)
        .where(ImportTemplate.organization_id == org_id)
        .order_by(ImportTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    return [ImportTemplateResponse.model_validate(t) for t in templates]


async def create_import_template(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ImportTemplateCreate,
) -> ImportTemplateResponse:
    template = ImportTemplate(
        organization_id=org_id,
        created_by=user_id,
        **data.model_dump(),
    )
    db.add(template)
    await db.flush()
    return ImportTemplateResponse.model_validate(template)


async def delete_import_template(
    db: AsyncSession,
    org_id: uuid.UUID,
    template_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(ImportTemplate).where(
            ImportTemplate.id == template_id,
            ImportTemplate.organization_id == org_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise ValueError("Import template not found.")
    await db.delete(template)
    await db.flush()
