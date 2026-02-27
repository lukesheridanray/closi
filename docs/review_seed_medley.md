# Seed Script Review: Medley & Sons Security Demo Data

**Date**: 2026-02-27
**Scope**: Run `backend/seed_medley.py` against PostgreSQL, fix errors, verify data integrity

---

## Summary

The seed script populates the CRM with realistic demo data for Medley & Sons Security, an ADT authorized dealer in Louisville, KY. One schema fix was required before the seed could run successfully.

## Pre-Run Issue Found

### Subscription.contract_id NOT NULL constraint (FIXED)

**Problem**: The `Subscription` model had `contract_id` as `nullable=False` with `ondelete="CASCADE"`, but Medley's business model does not use formal contracts. Subscriptions represent month-to-month monitoring with no fixed term.

**Fix applied**:
- `backend/app/models/subscription.py`: Changed `contract_id` to `Mapped[uuid.UUID | None]`, `nullable=True`, `ondelete="SET NULL"`
- Changed relationship to `Mapped["Contract | None"]`
- Generated migration: `b48584ef1dcc_make_subscription_contract_id_nullable.py`
- Applied migration successfully

**Rationale**: Not all business models require contracts. A subscription can exist independently (month-to-month monitoring). This is a legitimate schema improvement, not a workaround.

---

## QA Review

### Data Counts (Verified)

| Table             | Expected | Actual | Status |
|-------------------|----------|--------|--------|
| organizations     | 1        | 1      | PASS   |
| users             | 5        | 5      | PASS   |
| contacts          | 35       | 35     | PASS   |
| pipelines         | 1        | 1      | PASS   |
| pipeline_stages   | 10       | 10     | PASS   |
| deals             | 26       | 26     | PASS   |
| stage_history     | 129      | 129    | PASS   |
| tasks             | 20       | 20     | PASS   |
| quotes            | 10       | 10     | PASS   |
| contracts         | 0        | 0      | PASS   |
| subscriptions     | 12       | 12     | PASS   |
| invoices          | 30       | 30     | PASS   |
| payments          | 16       | 16     | PASS   |
| activities        | 30       | 30     | PASS   |

### Deal Distribution by Stage (Verified)

| Stage                   | Count |
|-------------------------|-------|
| New Lead                | 3     |
| Contacted               | 3     |
| Consultation Scheduled  | 2     |
| Consultation Complete   | 2     |
| Quote Sent              | 3     |
| Negotiation             | 2     |
| Install Scheduled       | 2     |
| Installed               | 1     |
| Won                     | 5     |
| Lost                    | 3     |
| **Total**               | **26**|

### Invoice Status Distribution (Verified)

| Status   | Count | Total       |
|----------|-------|-------------|
| draft    | 2     | $114.98     |
| paid     | 16    | $22,264.92  |
| past_due | 2     | $94.98      |
| sent     | 8     | $399.92     |
| void     | 2     | $104.98     |

### Other Verifications

- Won stage name = "Won" (not "Contract Signed") -- PASS
- All 12 subscriptions have `contract_id = NULL` -- PASS
- All 5 user passwords verified against `Demo1234!` -- PASS
- Quote statuses: 3 accepted, 3 sent, 2 draft, 1 rejected, 1 expired -- PASS
- Task statuses: 8 completed, 12 pending (includes 2 overdue) -- PASS

### Minor Notes

- The `(trapped) error reading bcrypt version` warning from passlib is cosmetic. It occurs because passlib checks for `bcrypt.__about__.__version__` which was removed in newer bcrypt versions. Hashing/verification works correctly. No action needed.
- Invoice count (30) is slightly lower than the "~40" estimate in the print summary. This is because the seed only creates Dec/Jan/Feb monitoring invoices for customers active long enough, plus 8 equipment invoices, 2 draft March invoices, and 2 void invoices. The print message could be updated but this is cosmetic.

---

## Security Review

| Check | Status | Notes |
|-------|--------|-------|
| No hardcoded secrets in production code | PASS | Password `Demo1234!` is demo-only seed data |
| SQL injection risk | PASS | Uses SQLAlchemy ORM, no raw string interpolation in queries |
| Idempotent cleanup uses parameterized deletes | PASS | `DELETE FROM` with no user input |
| FK constraints enforced | PASS | All foreign keys validated by database |
| org_id isolation | PASS | All records share one org_id; multi-tenant isolation maintained |
| ondelete behavior | PASS | Subscription.contract_id now uses SET NULL (not CASCADE) |
| Password hashing | PASS | bcrypt via passlib, no plaintext storage |

### Recommendation

- When moving to production, ensure `Demo1234!` passwords are not present. The seed is development-only.

---

## Audit Review

### Schema Change Audit Trail

| Change | Migration | Reversible |
|--------|-----------|------------|
| `subscriptions.contract_id`: NOT NULL -> nullable | `b48584ef1dcc` | Yes (downgrade available) |
| `subscriptions.contract_id` FK: CASCADE -> SET NULL | `b48584ef1dcc` | Yes |

### Business Model Alignment

- **Contracts table**: 0 rows. Correct for Medley's no-contract model.
- **Subscriptions**: All 12 have `contract_id = NULL`. Correct.
- **Pipeline won stage**: Named "Won" (not "Contract Signed"). Correct.
- **Invoices**: Split between one-time equipment (8) and recurring monitoring. Correct.
- **Quotes**: Still reference `contract_term_months` field -- this is acceptable as it represents monitoring duration estimate on the quote, not a binding contract term.

---

## Verdict

**PASS** -- Seed script runs cleanly after the one schema fix. All data is consistent and reflects Medley & Sons' actual business model.
