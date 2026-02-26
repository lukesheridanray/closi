# CRM Project: Claude Code Handoff

## Project Overview

A CRM platform for small service businesses with recurring revenue, starting with the home security dealer market. The product replaces tools like FillQuick and SecurityTrax by combining lead management, sales pipeline, contract/subscription billing, invoicing, inventory tracking, and analytics in a single platform with payment processor and lead source integrations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 + Alembic |
| Auth | JWT (access + refresh tokens) with RBAC |
| Task Queue | Celery + Redis |
| File Storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| Real-time | WebSockets (FastAPI native) |
| Hosting | Railway |
| Payments | Stripe SDK + Authorize.net SDK |
| Icons | Lucide React |
| Charts | Recharts |
| Drag & Drop | @dnd-kit (for pipeline kanban) |
| Date Handling | date-fns |
| Forms | React Hook Form + Zod validation |
| HTTP Client | Axios (frontend to backend) |
| State Management | Zustand (lightweight, no boilerplate) |

## Project Structure

```
crm/
├── docs/                               # Design & architecture docs
│   ├── 01_core_data_model.md           # Contacts, deals, quotes, contracts, payments
│   ├── 02_transformation_engine.md     # Lead ingestion, field mapping, dedup
│   ├── 03_payment_layer.md             # Payment abstraction, Stripe/AuthNet adapters
│   ├── 04_crm_reference.md             # Full CRM knowledge base, UI/UX patterns
│   ├── 05_extended_models.md           # Tasks, calendar, inventory, auth, analytics
│   ├── 06_design_system.md             # Colors, typography, components, layout
│   └── 07_scaffolding.md               # This file
│
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app entry, middleware, CORS
│   │   ├── config.py                   # Environment config (pydantic-settings)
│   │   ├── database.py                 # SQLAlchemy engine, session, base
│   │   │
│   │   ├── models/                     # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── organization.py
│   │   │   ├── user.py
│   │   │   ├── contact.py
│   │   │   ├── deal.py
│   │   │   ├── stage_history.py
│   │   │   ├── pipeline.py
│   │   │   ├── task.py
│   │   │   ├── quote.py
│   │   │   ├── contract.py
│   │   │   ├── subscription.py
│   │   │   ├── invoice.py
│   │   │   ├── payment.py
│   │   │   ├── product.py
│   │   │   ├── inventory.py
│   │   │   ├── integration_source.py
│   │   │   ├── field_mapping.py
│   │   │   ├── raw_inbound_log.py
│   │   │   └── payment_provider.py
│   │   │
│   │   ├── schemas/                    # Pydantic request/response schemas
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── contact.py
│   │   │   ├── deal.py
│   │   │   ├── task.py
│   │   │   ├── quote.py
│   │   │   ├── contract.py
│   │   │   ├── invoice.py
│   │   │   ├── inventory.py
│   │   │   ├── pipeline.py
│   │   │   └── analytics.py
│   │   │
│   │   ├── api/                        # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── contacts.py
│   │   │   ├── deals.py
│   │   │   ├── tasks.py
│   │   │   ├── quotes.py
│   │   │   ├── contracts.py
│   │   │   ├── invoices.py
│   │   │   ├── payments.py
│   │   │   ├── inventory.py
│   │   │   ├── pipelines.py
│   │   │   ├── analytics.py
│   │   │   ├── integrations.py
│   │   │   └── webhooks.py
│   │   │
│   │   ├── services/                   # Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── contact_service.py
│   │   │   ├── deal_service.py
│   │   │   ├── task_service.py
│   │   │   ├── quote_service.py
│   │   │   ├── contract_service.py
│   │   │   ├── invoice_service.py
│   │   │   ├── inventory_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── notification_service.py
│   │   │
│   │   ├── integrations/               # External service adapters
│   │   │   ├── __init__.py
│   │   │   ├── payment_adapter.py      # Abstract base class
│   │   │   ├── stripe_adapter.py
│   │   │   ├── authnet_adapter.py
│   │   │   ├── lead_transformer.py     # Transformation engine
│   │   │   ├── calendar_sync.py        # Google/Outlook calendar
│   │   │   └── email_sender.py         # Resend integration
│   │   │
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── tenant.py              # Org scoping from JWT
│   │   │   └── auth.py               # JWT verification + role checking
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── phone.py               # Phone number normalization
│   │       ├── pdf.py                 # Invoice PDF generation
│   │       └── dedup.py               # Contact deduplication logic
│   │
│   ├── alembic/                       # Database migrations
│   │   ├── versions/
│   │   └── env.py
│   │
│   ├── celery_app.py                  # Celery config + task registration
│   ├── tasks/                         # Celery task definitions
│   │   ├── lead_processing.py
│   │   ├── payment_webhooks.py
│   │   ├── invoice_generation.py
│   │   ├── failed_payment_retry.py
│   │   └── notifications.py
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── components/                 # Shared UI components
│   │   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── IconNavRail.tsx     # 60px left icon nav
│   │   │   │   ├── SidebarPanel.tsx    # 280px left panel
│   │   │   │   ├── PageHeader.tsx      # Top bar with title + search
│   │   │   │   ├── MainLayout.tsx      # Three-column wrapper
│   │   │   │   └── SlideOutPanel.tsx   # Right-side drawer for detail views
│   │   │   ├── shared/
│   │   │   │   ├── DataTable.tsx       # Reusable sortable/filterable table
│   │   │   │   ├── KPICard.tsx         # Metric card with trend
│   │   │   │   ├── StatusBadge.tsx     # Colored pill badges
│   │   │   │   ├── EmptyState.tsx      # Illustration + CTA
│   │   │   │   ├── GlobalSearch.tsx    # Cmd+K search modal
│   │   │   │   ├── ViewToggle.tsx      # LIST / GRID switcher
│   │   │   │   ├── Pagination.tsx
│   │   │   │   └── ActivityTimeline.tsx
│   │   │   └── forms/
│   │   │       ├── ContactForm.tsx
│   │   │       ├── DealForm.tsx
│   │   │       ├── TaskForm.tsx
│   │   │       ├── QuoteBuilder.tsx
│   │   │       └── InventoryForm.tsx
│   │   │
│   │   ├── pages/                      # Route-level pages
│   │   │   ├── auth/
│   │   │   │   ├── SignIn.tsx
│   │   │   │   ├── SignUp.tsx
│   │   │   │   ├── CompanyDetails.tsx
│   │   │   │   ├── ForgotPassword.tsx
│   │   │   │   └── AcceptInvite.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── Dashboard.tsx
│   │   │   ├── contacts/
│   │   │   │   ├── ContactList.tsx
│   │   │   │   └── ContactDetail.tsx
│   │   │   ├── pipeline/
│   │   │   │   └── PipelineBoard.tsx   # Kanban drag-and-drop
│   │   │   ├── tasks/
│   │   │   │   └── TaskList.tsx
│   │   │   ├── calendar/
│   │   │   │   └── Calendar.tsx
│   │   │   ├── quotes/
│   │   │   │   ├── QuoteList.tsx
│   │   │   │   └── QuoteDetail.tsx
│   │   │   ├── contracts/
│   │   │   │   ├── ContractList.tsx
│   │   │   │   └── ContractDetail.tsx
│   │   │   ├── invoices/
│   │   │   │   ├── InvoiceList.tsx
│   │   │   │   └── InvoiceDetail.tsx
│   │   │   ├── inventory/
│   │   │   │   └── InventoryDashboard.tsx
│   │   │   ├── reports/
│   │   │   │   └── Reports.tsx
│   │   │   └── settings/
│   │   │       ├── OrgSettings.tsx
│   │   │       ├── PipelineSettings.tsx
│   │   │       ├── IntegrationSettings.tsx
│   │   │       ├── PaymentSettings.tsx
│   │   │       └── TeamSettings.tsx
│   │   │
│   │   ├── hooks/                      # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useContacts.ts
│   │   │   ├── useDeals.ts
│   │   │   ├── useTasks.ts
│   │   │   ├── useAnalytics.ts
│   │   │   └── useWebSocket.ts
│   │   │
│   │   ├── stores/                     # Zustand state stores
│   │   │   ├── authStore.ts
│   │   │   ├── pipelineStore.ts
│   │   │   └── notificationStore.ts
│   │   │
│   │   ├── lib/                        # Utilities
│   │   │   ├── api.ts                  # Axios instance with JWT interceptor
│   │   │   ├── utils.ts               # cn() helper, formatters
│   │   │   └── constants.ts
│   │   │
│   │   └── types/                      # TypeScript type definitions
│   │       ├── contact.ts
│   │       ├── deal.ts
│   │       ├── task.ts
│   │       ├── invoice.ts
│   │       ├── pipeline.ts
│   │       └── analytics.ts
│   │
│   ├── tailwind.config.ts              # Custom theme from design system
│   ├── tsconfig.json
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml                  # Local dev: backend + frontend + postgres + redis
├── .gitignore
└── README.md
```

## Build Order (Phase 1 MVP)

Build in this exact sequence. Each step builds on the previous one.

### Step 1: Project Setup
- Initialize frontend with Vite + React + TypeScript
- Initialize backend with FastAPI
- Set up PostgreSQL with Docker Compose
- Configure Tailwind with the design system colors/fonts
- Install shadcn/ui and configure components
- Set up Alembic for migrations

### Step 2: Auth + Multi-tenancy
- ORGANIZATION and USER models
- Registration flow (create org + owner)
- Login / logout / refresh token endpoints
- JWT middleware with org_id scoping
- Role-based permission checking
- Frontend: Sign In, Sign Up, Company Details screens (match UI kit auth pages)

### Step 3: Layout Shell
- Icon Nav Rail (left 60px)
- Sidebar Panel (left 280px)
- Page Header
- Main Content Area
- Global Search (Cmd+K)
- Route setup for all pages (empty placeholders)

### Step 4: Pipeline + Deals
- PIPELINE and PIPELINE_STAGE models
- DEAL model + STAGE_HISTORY
- Pipeline settings page (customize stages)
- PipelineBoard with drag-and-drop kanban
- SlideOutPanel for deal detail
- Deal create/edit form

### Step 5: Contacts
- CONTACT model
- Contact list with DataTable (search, filter, sort, pagination)
- Contact detail page with activity timeline
- Contact create/edit form
- Associate contacts with deals

### Step 6: Tasks
- TASK model
- Task list page (filterable by status, assignee, due date)
- Quick-add task from contact or deal
- Task completion flow
- Overdue task indicators
- Dashboard widget: tasks due today

### Step 7: Quotes + Contracts
- QUOTE model with line items
- Quote builder form
- Quote PDF generation
- CONTRACT model
- Contract creation from accepted quote
- Contract list and detail views

### Step 8: Dashboard
- KPI cards (MRR, pipeline value, deals won, conversion rate)
- Pipeline by stage chart
- Revenue over time chart
- Lead source breakdown
- Rep leaderboard
- Recent activity feed
- Failed payment alerts

### Step 9: Invoicing
- INVOICE model with line items
- Invoice PDF generation (template from design system)
- Invoice list and detail views
- Send invoice via email
- Invoice status tracking

### Step 10: Payment Integration
- PAYMENT_PROVIDER_CONFIG model
- Stripe adapter (Phase 1 processor)
- Customer creation on contract sign
- Subscription setup for recurring billing
- Webhook listener for payment events
- Failed payment handling + retry logic
- Payment history on contact record

## Phase 2 (post-MVP)
- Authorize.net adapter
- Lead transformation engine (Google Ads, Facebook webhooks)
- Inventory management
- Calendar sync (Google / Outlook)
- Alarm.com integration
- Email templates + automation
- Mobile-responsive views
- CSV import/export

## Phase 3 (product maturity)
- SpotOn adapter
- Customer self-service portal
- Automated workflows (if/then triggers)
- Advanced analytics + custom report builder
- Team performance dashboards
- API documentation for third-party integrations

---

## Key Instructions for Claude Code

1. **Always reference docs/ folder** before building any feature. The data models, design system, and business logic are all documented there.

2. **Follow the design system exactly.** Use the colors, typography, spacing, and component patterns from 06_design_system.md. The primary color is #6C63FF. Use Inter font. Use bottom-border input style, not bordered boxes.

3. **Multi-tenancy is non-negotiable.** Every database query must be scoped by organization_id. Every model (except Organization and User) has an organization_id FK. Enforce this in middleware.

4. **Use SlideOutPanel pattern** for viewing/editing records from list or pipeline views. Don't navigate to a new page when the user clicks a deal card or table row. Show a right-side drawer instead.

5. **Pipeline kanban is the hero screen.** This needs to feel smooth. Use @dnd-kit for drag-and-drop. Show deal value, contact name, and days in stage on each card. Animate transitions.

6. **Never lose data.** The RAW_INBOUND_LOG and PAYMENT_WEBHOOK_LOG tables exist for a reason. Every external payload is stored before processing.

7. **Build the backend service layer.** Don't put business logic in route handlers. Routes call services, services call the database. This keeps things testable and clean.

8. **TypeScript is strict.** Enable strict mode. Define types for all API responses. No "any" types.

9. **Never use em dashes in any UI text, error messages, or notifications.** The user explicitly hates them. Use commas, periods, or separate sentences instead.
