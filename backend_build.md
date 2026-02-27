# CLOSI Backend Build Prompt

## How to use this file

Tell Claude Code: "Read docs/backend_build.md and execute each phase in order. Do not move to the next phase until the current one compiles and works. Test each phase before proceeding."

---

## Current State

The frontend is built with mock Zustand stores. All data is fake. No real backend exists yet. We need to build the full backend, seed it with realistic data, and wire the frontend to it.

---

## Phase 1: Backend Foundation (Models + Migrations + API + Auth)

### 1A: SQLAlchemy Models

Create all SQLAlchemy models in backend/app/models/ matching the docs. Reference these files for exact field definitions, types, and relationships:

- 01_core_data_model.md: Contact, Deal, StageHistory, Activity, Quote, Contract, Payment, Referral, GoogleLead
- 05_extended_models.md: Organization, User (with roles), Pipeline, PipelineStage, Task, TaskComment, CalendarSync, Product, InventoryLocation, InventoryStock, InventoryTransaction, Subscription, Invoice

Every model (except Organization) must have an organization_id FK. This is non-negotiable for multi-tenancy.

Use UUID primary keys for all tables. Include created_at and updated_at timestamps on every model.

### 1B: Alembic Migrations

Generate and run Alembic migrations for all models:

```
alembic revision --autogenerate -m "create all tables"
alembic upgrade head
```

Verify all tables are created correctly in PostgreSQL.

### 1C: JWT Authentication

Build the full auth system in backend/app/api/auth.py and backend/app/services/auth_service.py:

Endpoints:

- POST /api/v1/auth/register (create org + owner user)
- POST /api/v1/auth/login (email + password, returns access + refresh tokens)
- POST /api/v1/auth/refresh (refresh token, returns new token pair)
- POST /api/v1/auth/logout (invalidate refresh token)
- POST /api/v1/auth/forgot-password (send reset email)
- POST /api/v1/auth/reset-password (set new password from reset token)
- POST /api/v1/auth/invite (owner/admin invites user by email)
- POST /api/v1/auth/accept-invite (invited user sets password)

JWT token structure:

```json
{
  "sub": "user_uuid",
  "org": "organization_uuid",
  "role": "owner",
  "email": "user@company.com",
  "iat": 1709000000,
  "exp": 1709003600
}
```

Access token TTL: 1 hour. Refresh token TTL: 30 days. Rotate refresh token on each refresh.

Password hashing with bcrypt. Store hashed passwords only.

### 1D: Multi-Tenancy Middleware

Build backend/app/middleware/tenant.py:

- Extract organization_id from JWT on every request
- Inject it into the request state
- Every database query automatically filters by organization_id
- Every INSERT automatically sets organization_id from the JWT
- Cross-tenant data access is impossible

### 1E: RBAC Middleware

Build backend/app/middleware/auth.py:

- Verify JWT on every protected endpoint
- Check user role against the permissions matrix in 05_extended_models.md
- Roles: owner, admin, manager, sales_rep, technician
- Create a decorator or dependency injection that checks permissions per endpoint
- Example: @require_role("owner", "admin") for user management endpoints
- Example: @require_role("owner", "admin", "manager", "sales_rep") for contact creation

### 1F: REST API Endpoints

Build CRUD endpoints for every entity. Reference 07_scaffolding.md for the file structure.

Contacts (backend/app/api/contacts.py):

- GET /api/v1/contacts (list with search, filter by source/status, sort, pagination)
- GET /api/v1/contacts/:id (detail with related deals, tasks, activities, invoices)
- POST /api/v1/contacts (create)
- PUT /api/v1/contacts/:id (update)
- DELETE /api/v1/contacts/:id (soft delete)
- POST /api/v1/contacts/import (CSV import)

Deals (backend/app/api/deals.py):

- GET /api/v1/deals (list with filter by stage, rep, date range)
- GET /api/v1/deals/:id (detail with stage history, activities, quotes)
- POST /api/v1/deals (create, auto-creates stage history entry)
- PUT /api/v1/deals/:id (update)
- PATCH /api/v1/deals/:id/stage (move to different stage, creates stage history entry)
- DELETE /api/v1/deals/:id (soft delete)

Pipeline (backend/app/api/pipelines.py):

- GET /api/v1/pipelines (list pipelines for org)
- GET /api/v1/pipelines/:id/stages (get all stages for a pipeline)
- POST /api/v1/pipelines/:id/stages (create new stage)
- PUT /api/v1/pipelines/:id/stages/:stage_id (update stage name, color, order, stale_days)
- DELETE /api/v1/pipelines/:id/stages/:stage_id (delete stage, with check for existing deals)
- PUT /api/v1/pipelines/:id/stages/reorder (batch reorder stages)

Tasks (backend/app/api/tasks.py):

- GET /api/v1/tasks (list with filter by status, assignee, due date, priority, type)
- GET /api/v1/tasks/:id (detail with comments)
- POST /api/v1/tasks (create)
- PUT /api/v1/tasks/:id (update)
- PATCH /api/v1/tasks/:id/complete (mark complete, log activity on related contact/deal)
- DELETE /api/v1/tasks/:id (soft delete)
- POST /api/v1/tasks/:id/comments (add comment)

Quotes (backend/app/api/quotes.py):

- GET /api/v1/quotes (list)
- GET /api/v1/quotes/:id (detail with line items)
- POST /api/v1/quotes (create with equipment line items + monitoring plan)
- PUT /api/v1/quotes/:id (update)
- POST /api/v1/quotes/:id/accept (convert to contract, move deal to Contract Signed)
- GET /api/v1/quotes/:id/pdf (generate and return PDF)

Contracts (backend/app/api/contracts.py):

- GET /api/v1/contracts (list with filter by status)
- GET /api/v1/contracts/:id (detail with subscription, payments, equipment)
- POST /api/v1/contracts (create from accepted quote)
- PUT /api/v1/contracts/:id (update)

Invoices (backend/app/api/invoices.py):

- GET /api/v1/invoices (list with filter by status, date range, customer)
- GET /api/v1/invoices/:id (detail with line items, payments)
- POST /api/v1/invoices (create)
- PUT /api/v1/invoices/:id (update)
- POST /api/v1/invoices/:id/send (send via email)
- PATCH /api/v1/invoices/:id/mark-paid (manual payment)
- PATCH /api/v1/invoices/:id/void (void invoice)
- GET /api/v1/invoices/:id/pdf (generate and return PDF)

Payments (backend/app/api/payments.py):

- GET /api/v1/payments (list with filter by contact, contract, status)
- GET /api/v1/payments/:id (detail)

Activities (backend/app/api/activities.py):

- GET /api/v1/activities (list, filterable by contact, deal, type)
- POST /api/v1/activities (log a call, email, note, meeting)

Analytics (backend/app/api/analytics.py):

- GET /api/v1/analytics/dashboard (owner dashboard KPIs + chart data)
- GET /api/v1/analytics/rep-dashboard (rep-specific dashboard)
- GET /api/v1/analytics/recurring-revenue (MRR dashboard data)
- GET /api/v1/analytics/pipeline-summary (stage counts and values)

Users (backend/app/api/users.py):

- GET /api/v1/users (list users in org, owner/admin only)
- POST /api/v1/users/invite (invite new user)
- PUT /api/v1/users/:id (update role, deactivate)

Organization (backend/app/api/organization.py):

- GET /api/v1/organization (get current org details)
- PUT /api/v1/organization (update org settings, marketing spend, etc.)

### 1G: Service Layer

Do NOT put business logic in route handlers. Routes call services, services call the database.

Build these services in backend/app/services/:

- auth_service.py (register, login, token generation, password hashing)
- contact_service.py (CRUD, deduplication, CSV import with scrubbing)
- deal_service.py (CRUD, stage transitions with history logging)
- task_service.py (CRUD, completion logging, overdue detection)
- quote_service.py (CRUD, PDF generation, accept/convert to contract)
- contract_service.py (CRUD, subscription creation, LTV calculation)
- invoice_service.py (CRUD, PDF generation, send email, overdue detection)
- analytics_service.py (dashboard queries, MRR calculations, KPI aggregations)
- notification_service.py (email sending via Resend)

### 1H: Pydantic Schemas

Build request/response schemas in backend/app/schemas/ for every entity. Include:

- Create schemas (what the frontend sends)
- Update schemas (partial updates)
- Response schemas (what the API returns)
- List response schemas (with pagination metadata)

Use strict validation. No optional fields that should be required.

### Verify Phase 1:

- All migrations run cleanly
- All API endpoints return proper responses (test with curl or httpie)
- Auth flow works: register, login, access protected endpoint, refresh token
- RBAC works: sales_rep cannot access admin endpoints
- Multi-tenancy works: user from org A cannot see org B data

---

## Phase 2: Seed Data

Build backend/seed.py per the spec in build_prompts.md:

- 1 organization: "Shield Home Security LLC", Dallas TX
- 5 users: 1 owner (Mike Reynolds), 1 admin/office manager (Sarah Mitchell), 2 sales reps (Jake Torres, Amanda Foster), 1 technician (Carlos Rivera)
- Default pipeline with 9 stages: New Lead, Contacted, Consultation Scheduled, Consultation Complete, Quote Sent, Negotiation, Install Scheduled, Installed, Contract Signed + Lost
- 30 contacts with realistic names, phone numbers, emails, Dallas-area addresses, varied lead sources (google_ads, facebook, referral, website, walk_in, cold_call)
- 20 deals spread across all pipeline stages with realistic values ($1,500 - $5,000 for equipment, $30-$60/month monitoring)
- 15 tasks: mix of completed, pending, and overdue. Types: follow_up, call, site_visit, install, email, meeting
- 5 quotes: mix of draft, sent, accepted
- 5 contracts with active subscriptions at different monthly amounts ($29.99, $39.99, $49.99, $54.99, $59.99)
- 10 invoices: mix of paid, sent, overdue
- 20 activities (calls, emails, notes, meetings) spread across contacts
- Stage history entries showing deals moving through the pipeline over the past 60 days
- Payment records for active contracts showing monthly charges over the past few months

Use realistic home security terminology: "Smart Home Starter Package", "Premium Protection Bundle", "24/7 Professional Monitoring", "Video Surveillance Add-On", site surveys, panel installations, camera installs, sensor kits, key fob access, doorbell cameras.

Make it runnable with: python seed.py
Make it idempotent: running it again drops and recreates all seed data.

### Verify Phase 2:

- Run python seed.py with no errors
- Query the database to verify all data exists
- Run it again to verify idempotence

---

## Phase 3: Connect Frontend to Backend

Replace every mock Zustand store with real API calls.

### 3A: Axios Setup

Build frontend/src/lib/api.ts:

- Create Axios instance with base URL pointing to FastAPI backend
- Add request interceptor: attach JWT access token to every request
- Add response interceptor: on 401, attempt token refresh. If refresh fails, redirect to login
- Export typed API methods for every endpoint

### 3B: Auth Flow

- Wire up Sign In page to POST /api/v1/auth/login
- Wire up Sign Up page to POST /api/v1/auth/register
- Store tokens in memory (Zustand store), NOT localStorage
- On app load, check for refresh token and auto-login
- Logout clears tokens and redirects to sign in
- Protected routes redirect to sign in if no valid token

### 3C: Replace Mock Stores

For every page, replace mock data with real API calls:

Contacts:

- ContactList fetches GET /api/v1/contacts with search, filter, sort, pagination params
- ContactDetail fetches GET /api/v1/contacts/:id
- Add Contact form POSTs to /api/v1/contacts
- Edit Contact PUTs to /api/v1/contacts/:id
- Add loading skeletons while fetching
- Add error toast on API failure

Pipeline:

- Table view fetches GET /api/v1/deals with stage grouping
- Board view fetches same data, displayed as kanban
- Drag-and-drop PATCHes /api/v1/deals/:id/stage
- Table view stage dropdown PATCHes /api/v1/deals/:id/stage
- New Deal form POSTs to /api/v1/deals
- Pipeline settings fetches/updates stages via pipeline API

Tasks:

- Task list fetches GET /api/v1/tasks with filters
- Complete task PATCHes /api/v1/tasks/:id/complete
- New task POSTs to /api/v1/tasks
- Quick-add from contact/deal includes contact_id or deal_id

Quotes:

- Quote list fetches GET /api/v1/quotes
- Quote builder POSTs to /api/v1/quotes
- Accept quote POSTs to /api/v1/quotes/:id/accept
- PDF download fetches GET /api/v1/quotes/:id/pdf

Contracts:

- Contract list fetches GET /api/v1/contracts
- Contract detail fetches GET /api/v1/contracts/:id with subscription and payment data

Invoices:

- Invoice list fetches GET /api/v1/invoices with filters
- Invoice detail fetches GET /api/v1/invoices/:id
- Send invoice POSTs to /api/v1/invoices/:id/send
- Mark paid PATCHes /api/v1/invoices/:id/mark-paid
- PDF download fetches GET /api/v1/invoices/:id/pdf

Dashboard:

- Owner dashboard fetches GET /api/v1/analytics/dashboard
- Rep dashboard fetches GET /api/v1/analytics/rep-dashboard
- Recurring revenue fetches GET /api/v1/analytics/recurring-revenue

Sidebar:

- Recent activity fetches GET /api/v1/activities?limit=5
- Overview metrics fetch from analytics dashboard endpoint

### 3D: Loading and Error States

- Every list page shows skeleton loaders while fetching (not blank, not permanent placeholders)
- Every form shows a loading spinner on submit button while POSTing
- API errors show toast notifications with the error message
- Network errors show a retry option
- Empty states show the empty state component with CTA (not skeleton loaders)

### Verify Phase 3:

- Register a new account, complete the full auth flow
- Login and see real seed data on every page
- Create, edit, and delete a contact
- Create a deal, move it through stages via drag-and-drop AND table dropdown
- Create a task, complete it, verify it appears on the contact timeline
- Verify sidebar shows real recent activity and overview metrics
- Verify dashboard shows real KPIs from seed data
- Verify all filters and search work against real data
- Verify pagination works with 30+ contacts

---

## Phase 4: Cleanup

### 4A: Code Splitting

- Add React.lazy() and Suspense for all route-level page components
- This fixes the Vite bundle size warning (>1MB)
- Each page loads only when navigated to

### 4B: TypeScript Strict Mode

- Fix any TypeScript errors
- Remove all "any" types
- Ensure all API responses have typed interfaces

### 4C: Design System Audit

- Walk through every page and verify it matches 06_design_system.md
- Check: colors, fonts, spacing, border radius, shadows, component styles
- Verify the CLOSI logo renders correctly in nav rail and auth pages
- Verify no em dashes appear anywhere in the UI

### 4D: Remaining Stubs

- PDF generation for quotes and invoices (use a PDF library like reportlab or weasyprint)
- Email sending for invoices and notifications (wire up Resend SDK)
- Calendar page can remain a placeholder for now (Phase 2 feature)
- Inventory page can remain a placeholder for now (Phase 2 feature)

### Verify Phase 4:

- No TypeScript errors in strict mode
- No console errors or warnings in the browser
- Bundle size under 500KB per chunk
- Every page matches the design system
- PDFs generate correctly with CLOSI branding
