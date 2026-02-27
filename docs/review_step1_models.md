# Step 1: SQLAlchemy Models & Migration - Review Report

## Team Roles
- **Product Owner**: Scope & requirements from crm_data_model.md, crm_extended_models.md, crm_payment_layer.md
- **Backend Engineer**: Model implementation, migration generation
- **QA Engineer**: Schema verification, FK/index validation, data integrity checks
- **Security/Compliance Engineer**: Multi-tenancy enforcement audit
- **Audit Analyst**: Spec compliance verification

---

## Files Created

| File | Models | Status |
|------|--------|--------|
| `app/models/contact.py` | Contact | Created |
| `app/models/pipeline.py` | Pipeline, PipelineStage | Created |
| `app/models/deal.py` | Deal | Created |
| `app/models/stage_history.py` | StageHistory | Created |
| `app/models/activity.py` | Activity | Created |
| `app/models/task.py` | Task, TaskComment | Created |
| `app/models/calendar_sync.py` | CalendarSync | Created |
| `app/models/quote.py` | Quote | Created |
| `app/models/contract.py` | Contract | Created |
| `app/models/subscription.py` | Subscription | Created |
| `app/models/invoice.py` | Invoice | Created |
| `app/models/payment.py` | Payment | Created |
| `app/models/product.py` | Product | Created |
| `app/models/inventory.py` | InventoryLocation, InventoryStock, InventoryTransaction | Created |
| `app/models/referral.py` | Referral | Created |
| `app/models/raw_inbound_log.py` | RawInboundLog | Created |
| `app/models/payment_provider.py` | PaymentProviderConfig, CustomerPaymentProfile, PaymentWebhookLog | Created |
| `app/models/import_template.py` | ImportTemplate | Created |
| `app/models/__init__.py` | All imports | Updated |

**Total: 22 models across 14 files + 1 init file**

## Migrations

| Migration | Description |
|-----------|-------------|
| `7f9b2237040c_create_all_tables.py` | Creates all 26 application tables |
| `36c2690101e8_add_missing_org_id_and_timestamps.py` | QA fix: adds organization_id to pipeline_stages and task_comments, created_at to inventory_stock and payment_webhook_logs |

Previous migration `ac1a963602eb_initial_schema.py` was removed (only had organizations + users; replaced by complete migration).

## QA Review

### Schema Verification
- [x] 26 application tables created (+ alembic_version = 27 total)
- [x] 83 foreign key constraints
- [x] 77 indexes (including org_id indexes on all tenant-scoped tables)
- [x] All tables have UUID primary keys
- [x] All tables have created_at timestamp
- [x] All tables (except organizations, inventory_stock) have organization_id FK

### Multi-Tenancy Compliance
- [x] organization_id present on every tenant-scoped table
- [x] organization_id indexed on all tables for query performance
- [x] CASCADE delete from organizations propagates correctly
- [x] inventory_stock is a junction table (product_id + location_id), scoped transitively through product/location org_id

### Data Model Coverage (vs. Spec)
- [x] Core: Contact, Deal, StageHistory, Activity, Quote, Contract, Payment, Referral, RawInboundLog (GoogleLead)
- [x] Extended: Task, TaskComment, CalendarSync, Pipeline, PipelineStage, Product, InventoryLocation, InventoryStock, InventoryTransaction
- [x] Payment: PaymentProviderConfig, CustomerPaymentProfile, Subscription, Invoice, PaymentWebhookLog
- [x] Import: ImportTemplate (for saved CSV column mappings)

## Security Review

- [x] All FKs use ondelete="CASCADE" for org deletion (clean tenant removal)
- [x] User-linked FKs use ondelete="SET NULL" (preserve data if user deactivated)
- [x] Password hash stored as String(255), never plaintext
- [x] Refresh token stored on User model for rotation tracking
- [x] Payment credentials stored as JSONB (encrypted at application layer, not DB)
- [x] No raw SQL in models; all queries go through SQLAlchemy ORM
- [x] Soft delete pattern (is_deleted flag) on Contact, Deal, Task for data preservation

## Audit Notes

### Schema Differences from Seed Script
The old seed.py created tables directly with different column names. Key changes:
- Contact: `address_line1` -> `address` (simpler, matches frontend)
- Deal: `value` -> `estimated_value`, `probability` removed (not in spec), `source` removed (lead_source lives on Contact)
- PipelineStage: `position` -> `sort_order`, `is_won`/`is_lost` -> `is_won_stage`/`is_lost_stage`
- Contract: removed `contract_number`/`stripe_customer_id`/`stripe_subscription_id` (moved to Subscription/PaymentProvider models)

**Action required**: seed.py must be updated in Phase 2 to match new model structure.

### Patterns Established
- UUID PKs via `uuid.uuid4` default
- `Mapped[]` type annotations with `mapped_column()`
- Relationships with `lazy="selectin"` for eager loading
- Consistent `__repr__` on every model
- `created_at`/`updated_at` with `datetime.utcnow` defaults
