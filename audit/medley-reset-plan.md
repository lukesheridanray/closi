# Closi Reset Plan for Medley & Sons

## Recommendation

Do not discard Closi, but do stop treating the current app as the final shape.

The current codebase already has the right business objects for a security installer CRM:

- contacts
- deals / pipeline
- quotes
- contracts
- subscriptions
- invoices / payments

That means the product direction is strong. The gap is that the app still behaves like a general CRM when Medley needs a vertical operating system for:

- automated lead intake
- follow-up tracking
- estimate scheduling
- quote to install workflow
- recurring monitoring revenue
- owner-facing analytics like MRR and CAC

## Customer Zero

Medley & Sons Security

Business model:

- local security installer
- residential and commercial jobs
- lead sources include Google, direct calls, form fills, referrals, and home inspectors
- workflow includes estimate, quote, close, install, and recurring monitoring

## What Medley Hates Today

- manual lead entry from Google and referral channels
- no clear view of monthly recurring revenue
- no clear view of customer acquisition cost or lead source ROI
- awkward payment flow through FillQuick / Authorize.net

## Current Repo Assessment

### Keep

- FastAPI backend domain model
- Postgres-first data design
- multi-tenant organization model
- quote, contract, and subscription primitives
- React frontend shell and authenticated app structure

### Change

- stop centering the app around generic CRM navigation
- stop relying on Railway as the long-term platform
- stop treating customization as label swaps only
- stop keeping analytics limited to dashboard vanity metrics

### Evidence in the Codebase

- Organization-level configuration already exists in `backend/app/models/organization.py`
- lead source and status already exist in `backend/app/models/contact.py`
- quote and contract revenue structure already exist in `backend/app/models/quote.py` and `backend/app/models/contract.py`
- recurring revenue structure already exists in `backend/app/models/subscription.py`
- current MRR endpoints already exist in `backend/app/services/analytics_service.py`

## Product Reframe

Closi should become a configurable field-sales and service CRM for security installers first.

The primary workflow should be:

1. lead captured
2. lead contacted
3. estimate scheduled
4. quote sent
5. won / lost
6. install scheduled
7. install completed
8. monitoring active

The core user experience should answer:

- where did this lead come from
- has anyone followed up yet
- what is the quote value
- what was sold
- when is install happening
- did they convert to recurring monitoring
- what channels are making money

## Recommended Platform Direction

### Hosting

Recommended baseline:

- frontend: Vercel
- API: Fly.io
- database: Neon Postgres
- object storage: S3 or Cloudflare R2
- background jobs: worker process on Fly.io at first, then move to a queue-backed worker if needed
- observability: Sentry + PostHog

Why:

- simpler than AWS on day one
- more scalable and operationally sane than Railway for this use case
- easy path to stronger infra later without rebuilding the product

### Longer-Term Upgrade Path

If the business grows into many tenants and heavier automation:

- move API and workers to AWS ECS or Kubernetes
- move Postgres to RDS
- add Redis for queues, caching, and rate limiting
- split ingestion / analytics jobs from request-serving workloads

This should be phase-two infrastructure, not the starting point.

## Architecture Direction

### Keep as a Modular Monolith

Do not jump to microservices.

Use one backend app with clear modules:

- auth and tenancy
- leads and contacts
- pipeline
- quoting
- installs
- subscriptions and payments
- analytics
- integrations

Why:

- faster iteration
- easier debugging
- safer for one product team
- enough headroom for customer-zero and early vertical expansion

### Add a Business Profile Layer

Use `Organization.settings` as the seed for a real business configuration system.

Each organization should be able to define:

- business vertical template
- entity labels
- pipeline stages
- lead sources
- required fields
- enabled modules
- dashboard layout
- default follow-up rules

This is the path to "built for each small business personally" without hard-forking the app for every customer.

## Proposed Data Model Additions

Add these before chasing polish:

### Lead Intake

- lead source category
- lead source detail
- acquisition channel cost snapshot
- referral partner
- original inbound payload / attribution metadata
- first response timestamp
- last outbound touch timestamp

### Job / Install Operations

- job type: residential or commercial
- estimate appointment datetime
- estimate outcome
- install appointment datetime
- install status
- technician assignment
- monitoring activation status

### Revenue Analytics

- attributed acquisition cost per lead or per source-period
- recurring conversion flag
- recurring start date
- recurring cancellation reason

## Immediate Product Gaps

### 1. Lead Ingestion

Highest-value gap.

Medley should not manually re-enter leads. The system needs:

- embeddable or API-backed web forms
- Google lead capture import or forwarding workflow
- referral intake flow for home inspectors
- manual entry as fallback, not the default

### 2. Follow-Up Workflow

The app should actively manage:

- call attempted
- no answer
- text sent
- waiting on reply
- appointment booked

This is more important than generic task lists for customer zero.

### 3. Analytics

MRR exists, but the real owner dashboard should include:

- leads by source
- appointments set rate
- quote close rate
- install completion count
- active monitoring count
- MRR
- net new MRR
- CAC by source
- revenue by source

### 4. Payments

The current flow needs simplification.

Recommendation:

- keep Authorize.net only if Medley has a strong business reason
- otherwise evaluate moving new customers to Stripe for a cleaner subscription and payment experience
- if Authorize.net must stay, isolate it behind a payment abstraction and treat it as an integration, not a product constraint

## Suggested Build Phases

### Phase 1: Medley Foundation

Goal: make the CRM operationally better than FillQuick for Medley.

Build:

- security-installer business template
- Medley-specific lead sources
- install-oriented pipeline defaults
- first-response and follow-up tracking
- owner analytics for MRR, source performance, and conversion funnel

### Phase 2: Intake and Automation

Goal: eliminate manual entry and memory-driven follow-up.

Build:

- lead capture endpoints and forms
- referral intake links
- follow-up automations
- basic reminders and SLA timers

### Phase 3: Install Ops and Payments

Goal: unify sale, install, and monitoring lifecycle.

Build:

- install scheduling
- technician assignment
- payment setup and recurring activation
- contract-to-subscription handoff visibility

### Phase 4: Multi-Vertical Expansion

Goal: make the product adaptable without custom code branches.

Build:

- vertical template system
- module toggles
- configurable dashboards
- configurable field packs and workflows

## Practical Recommendation for the Next Build Sprint

Start with a narrow reset, not a rewrite.

First sprint should produce:

- a "Security Installer" org template
- Medley lead source configuration
- a revised pipeline focused on intake to install
- analytics cards for MRR, leads by source, and close rate
- a clear deployment target away from Railway

## Decision

Recommended path:

1. evolve Closi instead of replacing it
2. replatform hosting away from Railway
3. focus the product tightly on Medley as customer zero
4. build configuration and templates so the product can later expand to adjacent small-business verticals

## Next Implementation Proposal

The next code sprint should implement:

1. security-installer organization template and seeded settings
2. Medley-specific pipeline stages and lead sources
3. analytics expansion for source attribution and CAC inputs
4. first-pass deployment configuration for Vercel + Fly.io + Neon
