# Step 5: Seed Data (Phase 2) - Review Report

## Team Roles
- **Product Owner**: Seed data requirements from Phase 2 spec
- **Backend Engineer**: Seed script using actual SQLAlchemy models
- **QA Engineer**: Data count verification, idempotence testing
- **Audit Analyst**: Completeness vs. spec check

---

## File Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/seed.py` | **Rewritten** | Complete rewrite using actual app models instead of inline table definitions |

## Key Changes from Old seed.py
- Imports real models from `app.models.*` instead of defining inline ORM classes
- Column names match actual models (`address` not `address_line1`, `estimated_value` not `value`, `sort_order` not `position`, `is_won_stage`/`is_lost_stage` not `is_won`/`is_lost`)
- Added missing entities: Quotes, Subscriptions, Invoices, Payments
- Added missing fields: `is_deleted`, `created_by`, `completed_by`, `due_time`, `duration_minutes`, `is_all_day`, `recurrence` on tasks
- User names updated per spec: Mike Reynolds (owner), Sarah Mitchell (admin), Jake Torres (rep), Amanda Foster (rep), Carlos Rivera (tech)
- Stage names updated per spec: "Consultation Scheduled/Complete" instead of "Site Survey"

---

## QA Review

### Data Counts (Verified Against Database)

| Entity | Spec | Actual | Status |
|--------|------|--------|--------|
| Organization | 1 | 1 | Pass |
| Users | 5 | 5 | Pass |
| Contacts | 30 | 30 | Pass |
| Pipeline | 1 | 1 | Pass |
| Pipeline Stages | 10 (9 + Lost) | 10 | Pass |
| Deals | 20 | 20 | Pass |
| Stage History | ~100 | 100 | Pass |
| Tasks | 15 | 15 | Pass |
| Quotes | 5 | 5 | Pass |
| Contracts | 5 | 5 | Pass |
| Subscriptions | 5 | 5 | Pass |
| Invoices | 10 | 10 | Pass |
| Payments | 5 | 5 | Pass |
| Activities | 20 | 20 | Pass |

### Idempotence
- [x] Running `python seed.py` twice produces identical results
- [x] DELETE FROM in reverse FK order prevents constraint violations
- [x] No duplicate key errors on second run

### Data Quality
- [x] Contacts have realistic Dallas-area addresses, phones, emails
- [x] Varied lead sources: google_ads, facebook, referral, website, walk_in
- [x] Deals spread across all 10 pipeline stages
- [x] Deal values: $1,200 - $5,200 (equipment) with $29.99 - $59.99/mo monitoring
- [x] Tasks: 5 completed, 10 pending/overdue; types: call, email, site_visit, install, follow_up
- [x] Quotes: 1 draft, 2 sent, 2 accepted
- [x] Contracts: all active with 36 or 48 month terms
- [x] Subscriptions: $29.99, $39.99, $44.99, $49.99, $54.99/mo
- [x] Invoices: 5 paid + 4 sent + 1 past_due
- [x] Stage history entries show deals moving through pipeline over 60 days
- [x] Home security terminology used: "Smart Home Starter", "Premium Protection Bundle", "24/7 Professional Monitoring", sensor kits, panel installations

---

## Audit Notes

- The bcrypt warning (`error reading bcrypt version`) is a known passlib/bcrypt version compatibility issue. It does not affect functionality -- passwords are hashed correctly.
- Equipment lines on quotes use realistic home security products with correct pricing.
- The seed uses `Session(engine)` (sync) rather than `AsyncSession` since it's a standalone script run via `python seed.py`, not through the FastAPI app.
