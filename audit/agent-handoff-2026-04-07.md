# LSRV CRM Agent Handoff

Date: April 7, 2026
Workspace: `/Users/luke/Documents/Playground/closi`

## What Was Built This Session

### 1. Billing Sprint (4 items)
- **Invoice-on-charge**: Every successful payment auto-generates a paid invoice and emails a receipt via Resend. Fallback tasks created if invoice generation fails.
- **Gateway reconciliation**: Pulls transactions from Authorize.net Reporting API, compares against local records, auto-corrects mismatches. "Reconcile Gateway" button on Billing Ops page. Daily Celery task at 2 AM UTC.
- **Monthly subscription billing**: Celery task at 6 AM UTC checks active subscriptions, creates invoices for payments, flags missing payments after 2-day grace period.
- **ACH/eCheck support**: Bank account profile creation via Authorize.net CIM, validated routing/account numbers, UI updated to show ACH vs card throughout.

### 2. Quote System
- Auto-generated titles from contact name (editable)
- Per-line discount percentages with strikethrough pricing
- No contract terms — month-to-month monitoring only
- "Create & Send" button — creates quote and emails immediately
- Full quote email with line items, pricing, discounts, Accept/Decline buttons
- Customer clicks Accept/Decline from email → signed JWT token → branded confirmation page → status updates in CRM
- Quote detail popup on account page with all actions: Send, Resend, Accept, Decline, Edit & Resend, Download PDF, Delete
- Quotes visible and actionable from account page, deal panel, and quotes page

### 3. Account Page Command Center
- **Inline deal stage selector** — dropdown to move deals through pipeline stages
- **Scheduling popup** — when moving to "Appointment Scheduled" or "Install Scheduled", date/time picker appears with suggested dates. Shared hook works on both account page and sales board.
- **Quotes card** — create, send, accept, decline, resend, view, delete quotes
- **Inline task creation** — add tasks with type, date, and title directly on the account
- **Billing actions needed** — auto-detects unbilled equipment and monitoring setup, one-click charge buttons
- **Compact billing bar** — shows payment method, monitoring amount, inline charge (pre-filled from quotes)
- **Edit contact** — edit button now works, turns contact card into editable form
- **Activity timeline** — updates in real-time after any billing action
- **Owner field** — resolved from UUID to user name

### 4. Pipeline / Sales Board
- **Pipeline stages restructured** for Medley's workflow:
  1. New Lead
  2. Appointment Scheduled
  3. Quote Sent
  4. Quote Accepted
  5. Install Scheduled
  6. Installed (= won, triggers automations)
  7. Lost
- **Stage automations**:
  - "Installed" → contact status changes to "customer", auto-charges equipment, auto-starts monitoring
  - Scheduling popup on "Appointment Scheduled" and "Install Scheduled"
- **Deal value updates** when quote is accepted
- **Removed dead buttons** (Rep filter, Date filter, Add Deal footer)
- **Wider columns** (320px)
- **Deal detail panel** — billing section with charge, quotes, UUID-free assigned to

### 5. Calendar
- Month-view grid with color-coded task pills by type (site visit, install, call, follow-up, meeting)
- Click any day → create task with pre-filled date
- Click any task → popup with details, Open Account, Mark Complete, Reschedule, Delete
- Backend date range filtering for task queries
- Calendar-specific task store fetch

### 6. Billing Everywhere
- Every customer touchpoint has billing actions: account page, deal panel, quote detail, agreement detail, invoice detail, billing ops, sidebar
- Shared `BillingActions` component for consistent "Billing Actions Needed" pattern
- Billing Ops page: Accounts tab + History & Invoices tab, inline charge per row, unpaid invoices card, reconciliation
- Agreement detail panel: Charge Equipment, Start Monitoring buttons, "Agreement" terminology throughout

### 7. UI/UX Changes
- SlideOutPanel → centered modal popup (wider, shorter, scrollable)
- "Contract" → "Agreement" renamed throughout all user-facing text
- "Add Contact" → "Add Lead" — dedicated full page at `/contacts/new`
- Pipeline always created by default on lead creation
- Accounts sorted newest first
- Sidebar replaced Recent Activity with actionable task queue (Overdue, Today, Upcoming)
- Dashboard stats (leads, follow-ups, installs) are clickable links

### 8. Install-Complete Auto-Billing
- When an install task is completed → auto-charges equipment from accepted quotes
- When a deal moves to "Installed" → auto-charges, marks contact as customer
- Failed charges create urgent follow-up tasks

### 9. Recurring Billing (ARB)
- Quote acceptance now attempts to create real ARB subscription at Authorize.net
- Falls back to local subscription record if no card on file
- Duplicate CIM profile handling — looks up existing profile by merchantCustomerId

### 10. Email Integration
- Resend configured with `noreply@foodenough.app` sender
- Payment receipts emailed on every charge
- Quote emails with full line items, pricing, Accept/Decline buttons
- Invoice emails on send

## Configuration

- **Resend API Key**: configured in `backend/.env` as `RESEND_API_KEY`
- **From email**: `noreply@foodenough.app` (foodenough.app domain, not lsrv.ai — single domain plan)
- **Authorize.net Sandbox**: API Login `5Cyx5ZEw7BR`, connected and working
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:8000`
- **Demo login**: `ethan@medleyandsons.com` / `Demo1234!`

## Known Issues / Incomplete

1. **Alarm.com integration** — plan documented at `audit/alarmcom-integration-plan.md`, needs dealer API access from Medley. Stub integration ready to build.
2. **Google Calendar / Apple Calendar sync** — placeholders on integrations settings page, not built yet. Google API is open and can be built anytime.
3. **MRR invoicing gaps** — webhook payments don't link to subscription_id, no dunning email on failed payment, `failed_payment_count` not incremented, no subscription status degradation. Plan exists.
4. **Frontend TypeScript build** — `npm run build` still fails due to pre-existing TS debt unrelated to this session's work.
5. **Quote "Edit & Resend"** — opens QuoteBuilder for a new quote, doesn't load the existing quote for editing.
6. **Billing history tab** — rows not yet clickable to view invoice/quote detail.

## User Preferences (Critical)

- **Act as product owner** — identify and fix issues proactively, don't ask permission
- **Think through the ENTIRE customer flow** — never fix one screen and leave others broken. Every change must be traced through all touchpoints.
- **No partial fixes** — every button must work, every panel must have billing actions, every label must be consistent
- **No contract terminology** — always "Agreement"
- **Month-to-month monitoring** — no contract terms
- **Billing must be available from every customer touchpoint** — account, deal, quote, agreement, invoice, billing ops
- **No oversized UI elements** — compact buttons, small text
- **Centered modals** — not right-side slide panels
- **Check encoding after edits** — no curly quotes in JS/TS files

## Files Changed This Session

### Backend (key files)
- `backend/app/integrations/authnet_service.py` — charge fixes, invoice-on-charge, reconciliation, ACH, duplicate profile handling
- `backend/app/services/invoice_service.py` — `create_invoice_for_payment()`, fixed `send_invoice()`
- `backend/app/services/notification_service.py` — payment receipt email, quote email with line items and accept/decline
- `backend/app/services/quote_service.py` — send_quote with email, accept_quote with ARB, deal value update
- `backend/app/services/task_service.py` — install-complete auto-charge trigger
- `backend/app/services/deal_service.py` — stage automations (installed → customer + billing)
- `backend/app/api/authnet.py` — reconcile endpoint, bank account endpoint
- `backend/app/api/quotes.py` — send endpoint, delete endpoint, customer accept/decline via JWT
- `backend/tasks/billing.py` — Celery tasks for reconciliation, subscription invoicing, overdue detection
- `backend/celery_app.py` — beat schedule for 3 daily tasks

### Frontend (key files)
- `frontend/src/pages/contacts/components/ContactDetail.tsx` — command center rebuild
- `frontend/src/pages/contacts/components/BillingConsole.tsx` — compact/expanded modes
- `frontend/src/pages/contacts/AddLead.tsx` — new full-page lead creation
- `frontend/src/pages/pipeline/PipelineBoard.tsx` — scheduling popup integration
- `frontend/src/pages/pipeline/components/DealDetailPanel.tsx` — billing, quotes, UUID fix
- `frontend/src/pages/quotes/components/QuoteBuilder.tsx` — discounts, auto-title, create & send
- `frontend/src/pages/quotes/components/QuoteDetailPanel.tsx` — full billing actions
- `frontend/src/pages/billing/BillingOps.tsx` — reconciliation, history tab, inline charge, unpaid invoices
- `frontend/src/pages/calendar/Calendar.tsx` — full calendar build
- `frontend/src/pages/contracts/ContractList.tsx` — agreement rename, month-to-month
- `frontend/src/pages/contracts/components/ContractDetailPanel.tsx` — billing actions, agreement terminology
- `frontend/src/components/layout/SlideOutPanel.tsx` — converted to centered modal
- `frontend/src/components/layout/SidebarPanel.tsx` — replaced activity with task queue
- `frontend/src/components/shared/BillingActions.tsx` — shared billing actions component
- `frontend/src/hooks/useSchedulingPrompt.tsx` — shared scheduling popup hook
- `frontend/src/lib/navigation.ts` — Agreements rename
- `frontend/src/stores/taskStore.ts` — calendar task fetch
- `frontend/src/stores/quoteStore.ts` — send, decline, delete actions

## Git State

Repo is dirty with extensive changes. Do not casually revert. Run `git status` to see full list.
