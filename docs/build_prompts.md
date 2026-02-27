# CLOSI Build Prompts (Updated)

## Steps 1-4: COMPLETE

---

## Step 5: Contacts

Step 4 is complete. Move to Step 5: Contacts. Reference 01_core_data_model.md for the Contact model. Build the contact list page with the DataTable component (search, filter by source, sort, pagination matching the UI kit table style). Build the contact detail page with the two-column layout: left side has contact info and related records, right side has the activity timeline. Include quick-action buttons for adding notes, logging calls, and creating tasks. Add ability to create a new deal directly from a contact record.

---

## Step 6: Tasks

Step 5 is complete. Move to Step 6: Tasks. Reference 05_extended_models.md for the Task and Task Comment models. Build the task list page with filters for status, assignee, due date, and priority. Add quick-add task from contact records and deal slide-out panels. Tasks should show overdue indicators (red) when past due date. Completing a task logs it as an activity on the related contact/deal timeline. Add a "Tasks Due Today" widget to the dashboard. Also add a task type dropdown: call, email, meeting, site_visit, install, follow_up, other.

---

## Step 7: Quotes + Contracts + Recurring Revenue Foundation

Step 6 is complete. Move to Step 7: Quotes and Contracts. Reference 01_core_data_model.md for the Quote and Contract models. Build a quote builder form with two sections:

1. Equipment line items (product name, quantity, unit price, total) with add/remove rows and auto-calculated totals. This is the one-time install charge.

2. Monitoring plan section: monthly monitoring amount, contract term length (12, 24, 36, 60 months), auto-renewal toggle.

Add PDF generation for quotes showing both the equipment total and the monthly monitoring commitment.

Build the Contract model that gets created when a quote is accepted. The contract stores both the one-time equipment charge and the recurring monthly monitoring amount. Contract detail view should show:

- Monthly monitoring amount
- Contract start date and term length
- Auto-renewal status
- Days until renewal/expiration
- Total lifetime revenue from this customer so far
- Payment history (every charge, succeeded or failed)
- Payment method on file
- Equipment installed list

When a contract is signed, move the associated deal to the "Contract Signed" stage automatically.

On the Contact detail view, add a subscription summary:

- Active subscription status with monthly amount
- Months as customer (tenure)
- Total lifetime revenue collected
- Payment health indicator: green (current), yellow (1 missed), red (2+ missed or past due)
- Equipment installed from inventory transactions

---

## Step 8: Dashboard + Financial Metrics + Recurring Revenue Dashboard

Step 7 is complete. Move to Step 8: Dashboard and Analytics. Reference 05_extended_models.md analytics specifications. Build three dashboard views:

### Owner/Admin Dashboard

Top KPI row:

- MRR (sum of all active subscriptions) with trend vs last month
- Pipeline Value (sum of open deals) with trend
- Deals Won This Month with trend
- Conversion Rate with trend

Second KPI row (financial health):

- CAC (Customer Acquisition Cost): marketing spend / new customers. Add a monthly marketing spend input field in Organization Settings so the owner can enter their ad spend manually.
- LTV (Lifetime Value): average monthly revenue \* (1 / monthly churn rate)
- LTV:CAC Ratio: green if above 3:1, yellow 2-3:1, red below 2:1
- Monthly Churn Rate: customers lost / total customers at month start, with trend arrow
- Net Revenue Retention: percentage, green if above 100%

Charts:

- Revenue Over Time (line chart, trailing 12 months)
- Pipeline by Stage (horizontal bar with deal count and value)
- Lead Source Performance (donut chart)
- ROI by Lead Source table: source, leads, conversions, revenue, spend (manual input per source in settings), ROI %
- Rep Leaderboard table
- Recent Activity Feed
- Stale Deals alert list
- Failed Payments alert list

### Sales Rep Dashboard

- My Open Deals count and value
- Deals Closed This Month
- Tasks Due Today
- My Pipeline by stage chart
- My Activity This Week bar chart
- My upcoming and overdue tasks

### Recurring Revenue Dashboard (separate page under Reports)

- Total MRR with trend line chart
- Net New MRR this month
- MRR breakdown: new, expansion, churned, reactivated
- Customer count: active, past due, cancelled
- Average Revenue Per Account
- Revenue at risk: contracts expiring in 30, 60, 90 days
- Churn waterfall chart: starting MRR + additions - losses = ending MRR
- Table of all active subscriptions sortable by: customer name, monthly amount, start date, tenure months, payment status, next billing date

This recurring revenue page is the most important financial view in the app. Make it the default view when clicking Reports in the nav.

---

## Step 9: Invoicing

Step 8 is complete. Move to Step 9: Invoicing. Reference 01_core_data_model.md for the Invoice model and 03_payment_layer.md for invoice generation details.

Build two types of invoices:

1. One-time invoice: for equipment installation charges
2. Recurring invoice: auto-generated monthly from active subscriptions

Invoice creation from contracts should pre-populate the line items. Include tax calculation and totals. Generate PDF invoices using CLOSI branding (use the logo from public folder, design system colors).

Build the invoice list page with filters: status (draft, sent, paid, overdue, cancelled), date range, customer name. Show overdue invoices with red status badges and days overdue count.

Invoice detail view shows full line item breakdown, payment history, and actions: send via email, mark as paid manually, void, and download PDF.

Overdue invoices should surface on both the main dashboard and the recurring revenue dashboard as alerts. Add an overdue amount total to the KPI cards.

Store generated PDFs in the configured file storage path.

On the contact detail view, add an Invoices tab showing all invoices for that customer with status and quick links.

---

## Step 10: Payment Integration

Step 9 is complete. Move to Step 10: Payment Integration. Reference 03_payment_layer.md for the full payment abstraction layer.

Build the PaymentAdapter abstract class and Stripe adapter. Implement:

- Customer creation in Stripe when a contract is signed
- Payment method attachment (card on file)
- Subscription creation for recurring monthly monitoring billing
- One-time charge for equipment installation
- Webhook listener at /api/v1/webhooks/stripe

Webhook processing:

- Log every incoming payload to webhook log table before processing
- Route events: payment_intent.succeeded, payment_intent.payment_failed, customer.subscription.deleted, charge.refunded
- On payment success: update invoice to paid, create payment record, update contact payment health to green
- On payment failure: update invoice, create failed payment record, update contact payment health (yellow for 1 miss, red for 2+)
- On subscription cancelled: update contract status, flag in recurring revenue dashboard, update churn metrics

Failed payment retry logic:

- Retry at +3 days, +7 days, +14 days after initial failure
- Email customer after each failure with payment update link
- After all retries exhausted: mark subscription past_due, notify owner, surface on dashboard as revenue at risk

Payment settings page (owner/admin only):

- Connect Stripe account (OAuth flow)
- View connected account status
- Configure retry schedule
- Set up email templates for payment failure notifications

Show payment history on:

- Contact detail view (all payments for this customer)
- Contract detail view (payments for this subscription)
- Invoice detail view (payments applied to this invoice)

After this step, run the full app end to end: create a contact, move through pipeline, send a quote, sign contract, generate invoice, and process a test payment through Stripe test mode.

---

## Seed Data (run after Step 5 is complete, update as new features are built)

Create a seed data script at backend/seed.py that populates the database with realistic home security dealer data. Include:

- 1 organization: "Shield Home Security LLC"
- 5 users: 1 owner, 1 admin/office manager, 2 sales reps, 1 technician
- 30 contacts with realistic names, phone numbers, emails, addresses, and varied lead sources (google_ads, facebook, referral, website, walk_in)
- 20 deals spread across all pipeline stages with realistic values ($1,500 - $5,000 for equipment, $30-$60/month monitoring)
- 15 tasks: mix of completed, pending, and overdue. Types include follow-up calls, site visits, install scheduling
- 5 contracts with active subscriptions at different monthly amounts
- 10 invoices: mix of paid, sent, and overdue
- 10 activities (calls, emails, notes) spread across contacts
- Stage history entries showing deals moving through the pipeline over the past 60 days with realistic timestamps
- Payment records for the active contracts showing monthly charges over the past few months

Use realistic home security terminology: equipment packages like "Smart Home Starter", "Premium Protection", monitoring plans, site surveys, panel installations, camera installs, etc.

Make it runnable with: python seed.py
Make it idempotent: running it again clears and recreates all seed data.

---

## Post-MVP Checklist

After all 10 steps are complete, do a final pass:

1. Fix any TypeScript errors (strict mode, no "any" types)
2. Ensure all tables match the design system from 06_design_system.md
3. Verify pipeline Table and Board views both work correctly with seed data
4. Test role-based access: login as each role and verify permissions
5. Run seed data and review every page with data populated
6. Check mobile responsiveness on common breakpoints
7. Verify all slide-out panels work correctly from list and pipeline views
8. Ensure the CLOSI logo appears correctly in nav rail and auth pages
9. Never use em dashes anywhere in the UI
10. Verify recurring revenue dashboard shows accurate MRR calculations
11. Test invoice PDF generation with CLOSI branding
12. Confirm deal stage changes from Table view dropdown and Board view drag-and-drop both update correctly
