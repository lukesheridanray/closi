# LSRV CRM Agent Handoff

Date: April 6, 2026  
Workspace: `/Users/luke/Documents/Playground/closi`

## Product Direction

- Brand name: `LSRV CRM`
- Customer zero: Medley & Sons Security
- Positioning: not a generic CRM, but a field-sales + install + recurring monitoring CRM for security installers
- Core business motion:
  1. Lead comes in from Google, calls, forms, or home inspector referrals
  2. Follow-up by phone/text
  3. Estimate scheduled
  4. Quote built
  5. Deal closed
  6. Install scheduled/completed
  7. Monitoring activated
  8. Monthly recurring revenue managed

The core business value is billing and recurring revenue visibility. If that is weak, the product misses the mark.

## High-Level Recommendation

- Keep the existing Closi domain model
- Rebrand the product as `LSRV CRM`
- Stop pushing it as a horizontal CRM
- Build vertical depth for Medley & Sons first
- Use Authorize.net as the first production billing provider because that matches the real customer workflow

Related planning doc:
- [`audit/medley-reset-plan.md`](/Users/luke/Documents/Playground/closi/audit/medley-reset-plan.md)

## What Is Already Running

- Frontend local app: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/api/v1/docs`
- Demo login:
  - Email: `ethan@medleyandsons.com`
  - Password: `Demo1234!`

## User Preferences Learned

- The user wants direct action, not repeated permission-seeking
- The user wants fixes done comprehensively, not as tiny patch-by-patch bandaids
- The user prefers practical product clarity over clever branding
- `LSRV CRM` is the chosen product name
- Billing must feel operational and trustworthy, not “SaaS demo-ish”

## Major Work Completed

### 1. Branding and product framing

- Replaced `Closi` / `L-SRV CRM` / `LSRV` inconsistencies across core UI surfaces with `LSRV CRM`
- Shifted language away from generic CRM positioning toward installer operations

Main files touched:
- [`frontend/index.html`](/Users/luke/Documents/Playground/closi/frontend/index.html)
- [`frontend/src/pages/auth/SignIn.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/auth/SignIn.tsx)
- [`frontend/src/components/layout/AuthLayout.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/components/layout/AuthLayout.tsx)
- [`frontend/src/components/layout/IconNavRail.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/components/layout/IconNavRail.tsx)
- [`frontend/src/lib/navigation.ts`](/Users/luke/Documents/Playground/closi/frontend/src/lib/navigation.ts)

### 2. Navigation and IA improvements

- Icon rail now has hover tooltips so users can understand each icon
- `Leads` was renamed to `Accounts` because leads and customers live on the same page
- `Billing` was added as a primary page, but moved lower in the nav to fit the real business lifecycle

Recommended nav shape now:
- Operations
- Sales Board
- Accounts
- Follow-Up
- Calendar
- Quotes
- Contracts
- Billing
- Invoices
- Inventory
- Monitoring

### 3. Activity sidebar click-through

- Recent activity items are now clickable
- Contact-related activity opens the matching account
- Deal-related activity opens the matching sales record
- Added hydration logic so the target record can open even if it was not already loaded in the current table/board state

Main files:
- [`frontend/src/components/layout/SidebarPanel.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/components/layout/SidebarPanel.tsx)
- [`frontend/src/stores/contactStore.ts`](/Users/luke/Documents/Playground/closi/frontend/src/stores/contactStore.ts)
- [`frontend/src/stores/pipelineStore.ts`](/Users/luke/Documents/Playground/closi/frontend/src/stores/pipelineStore.ts)
- [`frontend/src/pages/contacts/ContactList.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/ContactList.tsx)
- [`frontend/src/pages/pipeline/PipelineBoard.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/pipeline/PipelineBoard.tsx)

### 4. Dashboard/product audit improvements

- Dashboard was reshaped away from generic/fake owner metrics toward more installer-relevant KPIs
- Placeholder-ish CAC/LTV emphasis was identified as risky
- Product audit conclusion: success depends on vertical focus, recurring revenue visibility, and lead/source analytics

Main file:
- [`frontend/src/pages/dashboard/Dashboard.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/dashboard/Dashboard.tsx)

### 5. Settings hub

- The old settings landing page was just “coming soon”
- It was replaced with an actual settings hub so `Payment Settings` is reachable through normal UI

Main file:
- [`frontend/src/pages/settings/OrgSettings.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/settings/OrgSettings.tsx)

### 6. Authorize.net-first payment settings

- Replaced the old Stripe-forward UI story with an Authorize.net-first payment settings page
- Added connection form for:
  - API Login ID
  - Transaction Key
  - Signature Key
  - Environment
- Product copy now reflects Medley’s real flow:
  - customer profile
  - card on file
  - upfront charge
  - recurring monitoring

Main file:
- [`frontend/src/pages/settings/PaymentSettings.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/settings/PaymentSettings.tsx)

### 7. Billing Ops page

- Added a dedicated `Billing` page with table-style billing operations view
- Intended as the operational workspace for:
  - customer name
  - billing flag
  - card-on-file status
  - monitoring amount
  - next billing date
  - last payment
  - failed-payment count
  - lifetime revenue

Backend:
- [`backend/app/api/billing.py`](/Users/luke/Documents/Playground/closi/backend/app/api/billing.py)
- [`backend/app/services/billing_service.py`](/Users/luke/Documents/Playground/closi/backend/app/services/billing_service.py)
- [`backend/app/schemas/billing.py`](/Users/luke/Documents/Playground/closi/backend/app/schemas/billing.py)

Frontend:
- [`frontend/src/pages/billing/BillingOps.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/billing/BillingOps.tsx)
- [`frontend/src/App.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/App.tsx)

### 8. Billing Console on customer record

- Added a per-account billing console inside the account detail view
- It is now built around a safer Authorize.net hosted flow rather than raw card entry inside the CRM

Main files:
- [`frontend/src/pages/contacts/components/BillingConsole.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/BillingConsole.tsx)
- [`frontend/src/pages/contacts/components/ContactDetail.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/ContactDetail.tsx)

Current Billing Console capabilities:
- Create billing profile
- Open Authorize.net hosted payment method page
- Sync customer payment profile back into CRM
- Run one-time upfront charge
- Create monitoring subscription

### 9. Hosted Authorize.net card-entry flow

- Raw card entry in the CRM UI was intentionally removed from the main path
- Hosted Authorize.net payment method flow now opens in a new tab/window
- CRM stores only operational metadata, not raw card data

Files:
- [`backend/app/integrations/authnet_service.py`](/Users/luke/Documents/Playground/closi/backend/app/integrations/authnet_service.py)
- [`backend/app/api/authnet.py`](/Users/luke/Documents/Playground/closi/backend/app/api/authnet.py)
- [`frontend/src/lib/authnetHostedPage.ts`](/Users/luke/Documents/Playground/closi/frontend/src/lib/authnetHostedPage.ts)

## Authorize.net Sandbox Status

The user connected sandbox credentials through the UI.

Sandbox credentials used during testing:
- API Login ID: `5Cyx5ZEw7BR`
- Transaction Key: `85aN83EZh6V9sY8C`
- Environment: `Sandbox`
- Signature key: blank for now

Important: these are sandbox credentials only.

What has been verified:
- Hosted customer payment page token generation works
- The sandbox hosted page opens successfully
- Saving a sandbox card produced an approved Authorize.net validation event
- The user received the standard validation receipt email from Authorize.net

What that means:
- The customer payment profile flow is basically working
- Card save on the Authorize.net side is not the current blocker

## Critical Bugs Already Fixed

### 1. API base mismatch

- Frontend was calling `/auth/login` instead of `/api/v1/auth/login`
- Fixed in [`frontend/src/lib/api.ts`](/Users/luke/Documents/Playground/closi/frontend/src/lib/api.ts)

### 2. CORS/backend local config issues

- Local environment/CORS issues were corrected so auth and frontend-backend communication work locally

Touched:
- [`backend/app/main.py`](/Users/luke/Documents/Playground/closi/backend/app/main.py)
- [`backend/app/config.py`](/Users/luke/Documents/Playground/closi/backend/app/config.py)
- local `.env` files

### 3. Runtime dependency issue

- Added missing backend dependency:
- [`backend/requirements.txt`](/Users/luke/Documents/Playground/closi/backend/requirements.txt)

### 4. Blank screens from missing due dates

- Contact detail tasks crashed when `due_date` was null
- Similar issue existed in deal detail
- Fixed in:
  - [`frontend/src/pages/contacts/components/ContactDetail.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/ContactDetail.tsx)
  - [`frontend/src/pages/pipeline/components/DealDetailPanel.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/pipeline/components/DealDetailPanel.tsx)

### 5. Blank screens from unknown activity types

- New billing activity types caused crashes in activity renderers because there was no icon config
- Fixed in:
  - [`frontend/src/types/contact.ts`](/Users/luke/Documents/Playground/closi/frontend/src/types/contact.ts)
  - [`frontend/src/pages/dashboard/components/RecentActivityFeed.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/dashboard/components/RecentActivityFeed.tsx)
  - [`frontend/src/pages/contacts/components/ActivityTimeline.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/ActivityTimeline.tsx)

Billing activity types added:
- `payment_succeeded`
- `payment_failed`
- `payment_refunded`
- `subscription_created`
- `subscription_cancelled`

Fallback icon handling was also added so unknown future types do not white-screen the app.

## Current Upfront Charge UX Work

The latest pass focused on the “nothing happens after Charge Customer” problem.

### What was improved

In [`frontend/src/pages/contacts/components/BillingConsole.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/BillingConsole.tsx):

- Added clear inline notices for:
  - info
  - success
  - error
- Added better charge section design:
  - charge target summary
  - amount preview
  - more explicit CTA copy
  - meaningful pending state while charging
- After a charge attempt, the UI now shows a local result summary:
  - approved vs failed
  - amount
  - description
  - transaction/payment id
  - timestamp
  - failure message if available
- The charge flow now refreshes billing/account data after the gateway call

In [`frontend/src/pages/contacts/components/ContactDetail.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/ContactDetail.tsx):

- Payment History now shows:
  - clearer labels
  - last 4 when available
  - failure message if available

### Why this matters

Before this pass:
- the button felt dead
- there was no confident “charge succeeded” moment
- there was no clear “charge failed because X” explanation
- the record did not feel freshly updated

After this pass:
- the charge action has a beginning, middle, and end
- the user gets immediate proof that something happened

## Known Remaining Problems

### 1. Upfront charge may still fail in sandbox

The user reported that an upfront charge failed. A direct API call confirmed that a payment record could come back with:
- `status: failed`
- `external_payment_id` present
- previously no useful `failure_message`

Backend improvements were made so failure details should now be extracted more reliably from the Authorize.net response:
- [`backend/app/integrations/authnet_service.py`](/Users/luke/Documents/Playground/closi/backend/app/integrations/authnet_service.py)
- [`backend/app/api/authnet.py`](/Users/luke/Documents/Playground/closi/backend/app/api/authnet.py)

This still needs re-testing in the UI after the latest frontend UX pass.

### 2. Auto-refresh after hosted card save may still need tightening

The app now tries to auto-sync card status when returning from the hosted Authorize.net page using:
- window focus
- visibility change
- `sessionStorage` marker

Files:
- [`frontend/src/pages/contacts/components/BillingConsole.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/BillingConsole.tsx)
- [`frontend/src/pages/billing/BillingOps.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/billing/BillingOps.tsx)

The user did report that they still needed to manually press `Refresh Card Status` at least once before the latest iteration. This should be revalidated.

### 3. Frontend build is still red

`npm run build` still fails, but the remaining failures are repo-wide pre-existing TypeScript issues outside this billing work.

Examples of still-open TS debt:
- sort handler typing mismatches
- nullable date handling in multiple pages
- stale pipeline/contact type mismatches
- chart formatter typings
- settings type mismatches

Recent build runs confirmed:
- billing files from the most recent pass are not the source of the remaining failures
- build still exits non-zero due unrelated legacy issues

### 4. Billing experience still needs one more real-world polish pass

Even after the recent improvements, the next agent should assume this workflow still needs:
- end-to-end manual testing in the browser
- small UX refinements after live use
- probably stronger success affordances on the Billing page as well, not just the account console

## Production/Compliance Direction

Do not store raw card numbers or CVV in `LSRV CRM`.

The intended production-safe direction is:
- use Authorize.net hosted/tokenized payment method entry
- keep raw card entry off our UI
- store only operational metadata:
  - external customer/profile IDs
  - external payment IDs
  - last 4
  - brand/type
  - exp month/year
  - payment/subscription state
  - failure history

This is the right direction for Medley and Sons and should not be reversed casually.

## Custom Skills Created

Project skills were scaffolded and installed both locally in the repo and globally in Codex:

Repo-local:
- [`/.codex/skills/closi-orchestrator/SKILL.md`](/Users/luke/Documents/Playground/closi/.codex/skills/closi-orchestrator/SKILL.md)
- [`/.codex/skills/frontend-builder/SKILL.md`](/Users/luke/Documents/Playground/closi/.codex/skills/frontend-builder/SKILL.md)
- [`/.codex/skills/backend-builder/SKILL.md`](/Users/luke/Documents/Playground/closi/.codex/skills/backend-builder/SKILL.md)
- [`/.codex/skills/code-reviewer/SKILL.md`](/Users/luke/Documents/Playground/closi/.codex/skills/code-reviewer/SKILL.md)
- [`/.codex/skills/ux-strategist/SKILL.md`](/Users/luke/Documents/Playground/closi/.codex/skills/ux-strategist/SKILL.md)

Also installed under:
- `/Users/luke/.codex/skills/...`

Intended team shape:
- orchestrator: main PM/integrator
- frontend-builder: UI/build work
- backend-builder: API/integration/data work
- code-reviewer: bug/regression review
- ux-strategist: workflow/interaction design

## Files With Important Recent Work

Backend:
- [`backend/app/api/authnet.py`](/Users/luke/Documents/Playground/closi/backend/app/api/authnet.py)
- [`backend/app/api/billing.py`](/Users/luke/Documents/Playground/closi/backend/app/api/billing.py)
- [`backend/app/config.py`](/Users/luke/Documents/Playground/closi/backend/app/config.py)
- [`backend/app/integrations/authnet_service.py`](/Users/luke/Documents/Playground/closi/backend/app/integrations/authnet_service.py)
- [`backend/app/main.py`](/Users/luke/Documents/Playground/closi/backend/app/main.py)
- [`backend/app/schemas/billing.py`](/Users/luke/Documents/Playground/closi/backend/app/schemas/billing.py)
- [`backend/app/services/billing_service.py`](/Users/luke/Documents/Playground/closi/backend/app/services/billing_service.py)
- [`backend/requirements.txt`](/Users/luke/Documents/Playground/closi/backend/requirements.txt)

Frontend:
- [`frontend/src/App.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/App.tsx)
- [`frontend/src/components/layout/AuthLayout.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/components/layout/AuthLayout.tsx)
- [`frontend/src/components/layout/IconNavRail.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/components/layout/IconNavRail.tsx)
- [`frontend/src/components/layout/SidebarPanel.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/components/layout/SidebarPanel.tsx)
- [`frontend/src/lib/api.ts`](/Users/luke/Documents/Playground/closi/frontend/src/lib/api.ts)
- [`frontend/src/lib/authnetHostedPage.ts`](/Users/luke/Documents/Playground/closi/frontend/src/lib/authnetHostedPage.ts)
- [`frontend/src/lib/navigation.ts`](/Users/luke/Documents/Playground/closi/frontend/src/lib/navigation.ts)
- [`frontend/src/pages/auth/SignIn.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/auth/SignIn.tsx)
- [`frontend/src/pages/billing/BillingOps.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/billing/BillingOps.tsx)
- [`frontend/src/pages/contacts/ContactList.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/ContactList.tsx)
- [`frontend/src/pages/contacts/components/ActivityTimeline.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/ActivityTimeline.tsx)
- [`frontend/src/pages/contacts/components/BillingConsole.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/BillingConsole.tsx)
- [`frontend/src/pages/contacts/components/ContactDetail.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/contacts/components/ContactDetail.tsx)
- [`frontend/src/pages/dashboard/Dashboard.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/dashboard/Dashboard.tsx)
- [`frontend/src/pages/dashboard/components/RecentActivityFeed.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/dashboard/components/RecentActivityFeed.tsx)
- [`frontend/src/pages/pipeline/PipelineBoard.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/pipeline/PipelineBoard.tsx)
- [`frontend/src/pages/pipeline/components/DealDetailPanel.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/pipeline/components/DealDetailPanel.tsx)
- [`frontend/src/pages/settings/OrgSettings.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/settings/OrgSettings.tsx)
- [`frontend/src/pages/settings/PaymentSettings.tsx`](/Users/luke/Documents/Playground/closi/frontend/src/pages/settings/PaymentSettings.tsx)
- [`frontend/src/stores/contactStore.ts`](/Users/luke/Documents/Playground/closi/frontend/src/stores/contactStore.ts)
- [`frontend/src/stores/pipelineStore.ts`](/Users/luke/Documents/Playground/closi/frontend/src/stores/pipelineStore.ts)
- [`frontend/src/types/contact.ts`](/Users/luke/Documents/Playground/closi/frontend/src/types/contact.ts)

## Suggested Next Steps For The Next Agent

### Immediate next priority

Re-test the upfront charge flow end to end in the browser with the latest UX changes.

Specifically verify:
- charge button shows loading state
- success notice appears when a charge succeeds
- error notice appears when a charge fails
- payment history refreshes immediately
- the “last charge result” block renders correctly
- no blank screens occur when interacting with new billing activity

### If the charge still fails

Inspect:
- browser network response from `/api/v1/integrations/authnet/charge`
- backend log output from Authorize.net charge path
- stored payment record returned by `/api/v1/payments/{id}`

Goal:
- ensure `failure_message` is never silently empty when a gateway decline occurs

### Next product sprint after stabilization

1. Lead/source analytics:
- Google vs inspector referral vs direct call visibility
- CAC/acquisition input model

2. Workflow shaping:
- lead -> estimate -> quote -> install -> monitoring lifecycle

3. Billing ops improvements:
- failed payment queue
- revenue at risk views
- retry follow-up tasks

4. Broader stability:
- repo-wide TypeScript cleanup
- more end-to-end pilot hardening

## Git/Workspace State

This repo is dirty with many intentional changes from this session. Do not casually revert.

At time of handoff, `git status --short` included modifications across:
- backend billing/authnet/config
- frontend app/nav/auth/dashboard/contacts/pipeline/settings/billing files
- new audit docs
- new skills folder

The next agent should inspect `git status` and continue carefully without discarding user-facing work.

## Summary In One Sentence

`LSRV CRM` has been pushed from “generic CRM MVP” toward “security installer operating system,” with real progress in billing architecture and UI, but the next agent should focus on validating and tightening the upfront charge flow until it feels dependable and production-like.
