# Home Security CRM - Data Model Design

## Core Entities

### 1. USER (internal team)
Sales reps, managers, admins. Every deal and activity ties back to a user for accountability and performance tracking.

### 2. CONTACT (the customer/prospect)
The central entity. One person, one record. Includes property info because home security is tied to a physical location. Lead source is captured at the contact level so you can always trace back where someone came from, whether that's Google Ads, a referral from an existing customer, or a door knock.

Key design decision: `lead_source` lives on Contact, not on Deal. A person only enters your world once, and you want to know how. If they come back for a second property later, a new Deal references the same Contact.

### 3. DEAL (the sales pipeline)
This is the thing that moves through your pipeline stages. One Contact can have multiple Deals (e.g., they upgrade systems, add a second property, or were lost and re-engaged later).

**Pipeline stages for home security:**
1. `new_lead` - just came in, untouched
2. `contacted` - rep has made first outreach
3. `consultation_scheduled` - site visit or call booked
4. `consultation_complete` - assessed the property
5. `quote_sent` - formal quote delivered
6. `negotiation` - back and forth on price/package
7. `install_scheduled` - they said yes, install date set
8. `installed` - equipment is in
9. `contract_signed` - monitoring agreement signed, recurring revenue starts
10. `lost` - didn't convert (with loss_reason captured)

### 4. STAGE_HISTORY
Every stage transition is logged. This is how you answer questions like:
- How long do deals sit in "quote_sent" before converting or dying?
- Which rep moves deals fastest through consultation to close?
- Where in the funnel are we losing the most people?

This is a simple append-only table. Never update, only insert.

### 5. ACTIVITY
Every touchpoint with a contact: calls, emails, notes, appointments, site visits. Ties to both a Contact and optionally a Deal. This is the activity feed on a contact record.

### 6. QUOTE
The formal proposal. Equipment breakdown (cameras, sensors, panel, doorbell), install fee, and the monthly monitoring price with contract term. A deal can have multiple quotes (first quote rejected, revised quote sent). `total_contract_value` is the calculated field your friend cares about: monthly * term months.

### 7. CONTRACT (where the money lives)
This is the most important entity for recurring revenue tracking. When a deal converts, a Contract is created. It holds the Stripe customer and subscription IDs for direct payment processor integration.

Key fields for revenue dashboards:
- `monthly_amount` - what they pay per month
- `term_months` - contract length (36, 48, 60 months typical in security)
- `status` - active, cancelled, expired, pending
- `cancelled_at` + `cancellation_reason` - churn tracking

From this single table you can calculate:
- **MRR** (Monthly Recurring Revenue): SUM of monthly_amount WHERE status = 'active'
- **Projected Annual Revenue**: MRR * 12
- **Churn Rate**: cancelled contracts / total contracts per period
- **Average Contract Value**: AVG of total_value
- **Revenue at Risk**: contracts expiring in next 90 days
- **LTV**: average monthly_amount * average contract duration

### 8. PAYMENT
Individual payment records synced from Stripe. Tracks every monthly charge, failed payments, and refunds. Failed payments are an early warning for churn.

### 9. REFERRAL
Tracks customer-to-customer referrals. The referrer gets credit (common in security: "refer a friend, get a month free"). Links the referring customer to the new contact and any resulting deal.

### 10. GOOGLE_LEAD
Raw inbound data from Google Ads lead forms via webhook. Stores the raw payload so nothing is lost, then processes it into a Contact + Deal. The `processing_status` field lets you build a reliable ingestion pipeline:
1. Webhook hits your endpoint, row inserted as `new`
2. Background job checks for existing contact match by email/phone
3. Creates or matches Contact, creates Deal in `new_lead` stage
4. Status updated to `deal_created`

This gives your friend the "Google leads flow into my CRM automatically" experience he's missing.

---

## Key Relationships

```
Google Lead --> creates --> Contact + Deal
Contact --> has many --> Deals
Deal --> moves through --> Stages (tracked in Stage History)
Deal --> has many --> Activities, Quotes
Deal --> converts to --> Contract (1:1)
Contract --> generates --> Payments (monthly)
Contact --> can refer --> other Contacts (via Referral)
User --> owns --> Deals, performs Activities
```

---

## Revenue Metrics (derived from Contract + Payment tables)

| Metric | Query Logic |
|--------|------------|
| MRR | SUM(monthly_amount) WHERE contract.status = 'active' |
| Net New MRR | New contracts this month - cancelled this month |
| Churn Rate | Cancelled contracts / active contracts at period start |
| Average Revenue Per Account | MRR / COUNT(active contracts) |
| LTV | Avg monthly * avg contract duration in months |
| Pipeline Value | SUM(deal.estimated_value) WHERE stage NOT IN ('lost', 'contract_signed') |
| Conversion Rate | Deals reaching 'contract_signed' / total deals |
| Failed Payment Rate | Failed payments / total payments this month |
| Revenue at Risk | SUM(monthly_amount) WHERE end_date within 90 days |

---

## Integration Points

### Google Ads
- Webhook endpoint receives lead form submissions
- Maps to GOOGLE_LEAD table, auto-creates Contact + Deal
- Campaign attribution preserved for ROI tracking

### Stripe (or payment processor)
- Customer created in Stripe when contract is signed
- Subscription created with monthly_amount and billing cycle
- Webhook listener for payment events (succeeded, failed, refunded)
- Syncs to PAYMENT table automatically

---

## Tech Stack Recommendation

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + Tailwind | Drag-and-drop pipeline, responsive dashboard |
| Backend | FastAPI (Python) | You know Python, fast to build, great async support |
| Database | PostgreSQL | Relational data, strong with financial queries, easy to host |
| Payments | Stripe API | Best documented, webhooks are solid |
| Auth | JWT (you've done this on FoodEnough) | Role-based access for reps vs managers |
| Hosting | Railway or Fly.io | Simple deployment, scales later |

Note: PostgreSQL over Snowflake here. This is an operational database (reads + writes on every user action), not an analytical warehouse. Snowflake would be overkill and too slow for transactional use. You could always sync to Snowflake later if you want to do heavy analytics.

---

## MVP Scope (Phase 1)

1. Contact management (add, edit, search)
2. Deal pipeline with drag-and-drop stage management
3. Google Lead webhook ingestion
4. Quote creation
5. Contract creation with MRR tracking
6. Dashboard: MRR, pipeline value, conversion rate, deals by stage
7. Basic auth with JWT

## Phase 2
- Stripe integration for automated billing
- Payment tracking and failed payment alerts
- Referral tracking
- Activity logging (calls, notes)
- Rep performance dashboards

## Phase 3
- Email/SMS notifications
- Automated follow-up reminders
- Customer portal (contract details, payment history)
- Mobile-friendly views for field reps
