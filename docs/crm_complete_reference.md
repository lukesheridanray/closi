# CRM: The Complete Product & Design Reference

## Part 1: What Is a CRM and Why It Exists

At its core, a CRM (Customer Relationship Management) system is a single source of truth for every interaction between a business and its customers. Before CRMs, this information lived in spreadsheets, sticky notes, email inboxes, and people's heads. When a salesperson quit, their relationships walked out the door with them.

A CRM solves three fundamental problems:

**Memory.** Who is this person, how did they find us, what have we talked about, and what did we promise them? A CRM stores every contact, every conversation, every deal, and every transaction so the business never forgets.

**Process.** What happens after a lead comes in? Who follows up? When? What's the next step? A CRM codifies the sales process into repeatable stages so nothing falls through the cracks and new hires can follow the playbook.

**Visibility.** How is the business actually doing? How many deals are in the pipeline? What's our close rate? Where are deals dying? Which rep is performing? A CRM turns raw activity into dashboards and reports that let owners and managers make informed decisions instead of guessing.

---

## Part 2: The Core Modules of a CRM

Every CRM, from a simple tool to Salesforce, is built from some combination of these modules. Not every business needs all of them, but understanding the full landscape helps you decide what to build and what to skip.

### 2.1 Contact Management

The foundation. Every CRM starts here.

**What it does:**
- Stores people (contacts) and companies (accounts/organizations)
- Tracks all communication history per contact (calls, emails, meetings, notes)
- Segments contacts by tags, lists, custom fields, or filters
- Deduplicates records (merge when same person enters from multiple sources)
- Stores custom fields unique to the business (e.g., property type, contract length)

**Key data per contact:**
- Name, email, phone, address
- Company/organization association
- Lead source (how they found you)
- Owner/assigned rep
- Tags and segments
- Activity timeline (every touchpoint in reverse chronological order)
- Associated deals, quotes, invoices, contracts
- Files and attachments
- Custom fields

**What good looks like:**
- A single contact record should give you the full story at a glance: who they are, how they got here, where they are in the process, and what's happened so far
- Search should be fast and fuzzy (partial name, phone, email all work)
- Duplicate detection should happen on creation, not after the fact

---

### 2.2 Deal/Opportunity Pipeline

This is what most people picture when they think "CRM." The visual pipeline.

**What it does:**
- Tracks potential sales from first contact to close (or loss)
- Organizes deals into stages that represent your sales process
- Shows deal value, expected close date, assigned rep, and probability
- Enables drag-and-drop movement between stages
- Captures loss reasons when deals die

**Typical pipeline stages (generic):**
1. New Lead
2. Contacted / Qualified
3. Discovery / Needs Analysis
4. Proposal / Quote Sent
5. Negotiation
6. Closed Won
7. Closed Lost

**What good looks like:**
- Kanban board view (columns = stages, cards = deals) is the dominant pattern
- Each card shows deal name, value, contact name, and days in stage
- Color coding or badges for stale deals (sitting too long in a stage)
- Pipeline value totals at the top of each column
- Filtering by rep, date range, deal value, source
- Ability to create multiple pipelines for different processes (sales vs. service vs. upsell)
- List/table view as an alternative to kanban for users who prefer it

---

### 2.3 Activity & Task Management

The day-to-day workhorse. What does the team need to do today?

**What it does:**
- Creates tasks with due dates, assignees, and priorities
- Logs activities (calls made, emails sent, meetings held, notes taken)
- Associates tasks/activities with contacts and deals
- Sends reminders and notifications
- Tracks completion status

**Types of activities:**
- Calls (logged manually or auto-logged via phone integration)
- Emails (synced from inbox or sent from CRM)
- Meetings/appointments
- Notes (free-text observations)
- Site visits / field visits
- Follow-up reminders

**What good looks like:**
- A "today" view showing all tasks due today across all contacts/deals
- Overdue tasks highlighted in red
- Quick-add from any contact or deal record (one click to "add task")
- Activity timeline on the contact record showing everything in order
- Ability to log an activity and schedule the next one in the same flow (e.g., "logged call, schedule follow-up in 3 days")

---

### 2.4 Calendar & Scheduling

Tightly coupled with tasks and activities.

**What it does:**
- Visual calendar showing appointments, installs, follow-ups
- Drag-and-drop rescheduling
- Two-way sync with Google Calendar and/or Outlook
- Tech/rep dispatch view (who is where, when)
- Customer-facing booking links (optional, for self-service scheduling)

**What good looks like:**
- Day, week, and month views
- Color coding by activity type or rep
- Side-by-side rep calendars for dispatching
- Click on a calendar event and see the associated contact/deal instantly
- Conflict detection (double-booking alerts)

---

### 2.5 Lead Management & Capture

How leads enter the system and how they're routed.

**What it does:**
- Captures leads from multiple sources (web forms, ads, referrals, manual entry, imports)
- Auto-assigns leads to reps based on rules (round-robin, territory, source)
- Scores leads based on engagement or fit criteria
- Converts leads to contacts + deals when qualified
- Tracks lead source attribution for ROI analysis

**What good looks like:**
- New leads appear instantly with a notification to the assigned rep
- Lead source is always captured (never "unknown")
- Duplicate detection on ingest (don't create a new record if they already exist)
- Speed-to-lead metrics (how fast did the rep respond?)
- Bulk import from CSV with field mapping UI

---

### 2.6 Quotes & Proposals

Formalizing the offer.

**What it does:**
- Creates itemized quotes tied to a deal
- Calculates totals, taxes, discounts
- Tracks quote status (draft, sent, viewed, accepted, rejected, expired)
- Generates PDF for email or print
- Supports versioning (revised quotes on the same deal)
- Optional e-signature integration

**What good looks like:**
- Quote builder with line items, quantities, prices
- Professional PDF template with business branding
- "Send quote" button that emails PDF and tracks when it's opened
- One-click "accept" that moves the deal to the next stage
- Quote-to-contract conversion flow

---

### 2.7 Invoicing & Billing

Getting paid.

**What it does:**
- Generates invoices from quotes or contracts
- Sends invoices via email with PDF attachment
- Tracks invoice status (draft, sent, viewed, paid, overdue, void)
- Accepts online payments (if integrated with payment processor)
- Handles recurring invoices for subscription/contract billing
- Sends payment reminders for overdue invoices

**What good looks like:**
- Invoice generated with one click from a closed deal or active contract
- Professional, branded PDF
- Clear payment status on the contact record
- Overdue invoices flagged on dashboard
- Payment link in the invoice email so customer can pay immediately
- Automatic recurring invoice generation for subscriptions

---

### 2.8 Reporting & Analytics

The decision-making layer.

**What it does:**
- Dashboards with real-time KPIs
- Pipeline reports (value by stage, conversion rates, velocity)
- Sales rep performance (deals closed, revenue generated, activities logged)
- Lead source ROI (which channels produce the most revenue, not just the most leads)
- Revenue reports (MRR, ARR, churn, LTV)
- Activity reports (calls made, emails sent, meetings booked)
- Forecasting (projected revenue based on pipeline and historical close rates)
- Custom report builder

**Common dashboard widgets:**
- Pipeline value by stage (horizontal bar or funnel)
- Revenue over time (line chart)
- Deals won vs lost this month/quarter
- Top performing reps (leaderboard)
- Lead source breakdown (pie chart or bar)
- Overdue tasks count
- MRR/ARR (for subscription businesses)
- Upcoming renewals / at-risk contracts

**What good looks like:**
- Dashboard loads fast and shows the 5-7 most important numbers
- Date range filters on everything
- Drill-down capability (click on a bar to see the underlying deals)
- Exportable to CSV or PDF
- Customizable per user role (owner sees revenue, rep sees their pipeline)

---

### 2.9 Email & Communication

Keeping conversations in context.

**What it does:**
- Two-way email sync (emails sent/received appear on contact timeline)
- Email templates for common messages
- Bulk email / email campaigns (lightweight, not full marketing automation)
- Email tracking (open rates, click rates)
- SMS messaging (if applicable)
- Internal notes and @mentions for team collaboration

**What good looks like:**
- Open an email from a contact and see their full CRM record beside it
- Send a templated follow-up email without leaving the CRM
- Know when a prospect opened your email
- Team members can @mention each other on a deal for handoffs

---

### 2.10 Inventory Management

Relevant for product/equipment-based businesses.

**What it does:**
- Tracks products/SKUs with quantities
- Associates inventory with locations (warehouse, trucks, offices)
- Decrements inventory when products are used in an install/sale
- Low stock alerts
- Transfer between locations
- Purchase order management

**What good looks like:**
- See what's in each tech's truck before dispatching
- Auto-deduct equipment when an install is completed
- Dashboard showing low-stock items
- History of what equipment went to which customer (for warranty/service)

---

### 2.11 Automation & Workflows

Reducing manual repetitive work.

**What it does:**
- Trigger-based automation (when X happens, do Y)
- Examples:
  - When a new lead comes in, assign to rep and send welcome email
  - When a deal sits in "quote sent" for 3 days, create a follow-up task
  - When a payment fails, notify the owner and create a task
  - When a contract is signed, create the subscription and deduct inventory
  - When a task is overdue by 2 days, escalate to manager

**What good looks like:**
- Visual workflow builder (if/then logic, no code required)
- Pre-built templates for common automations
- Activity log showing what automations fired and why
- Easy to turn on/off without breaking things

---

### 2.12 Integrations

No CRM is an island.

**Common integration categories:**
- **Email:** Gmail, Outlook (two-way sync)
- **Calendar:** Google Calendar, Outlook Calendar
- **Payment processors:** Stripe, Square, Authorize.net, PayPal
- **Accounting:** QuickBooks, Xero, FreshBooks
- **Phone/VoIP:** RingCentral, Twilio, Aircall (call logging, click-to-call)
- **Marketing:** Mailchimp, ActiveCampaign, Facebook Ads, Google Ads
- **Documents:** DocuSign, PandaDoc (e-signatures)
- **Communication:** Slack, Teams (notifications)
- **Monitoring stations:** Alarm.com, ADT, etc. (industry-specific)
- **Zapier/Make:** Catch-all for connecting to anything without a native integration

---

## Part 3: UI/UX Design Patterns for CRMs

### 3.1 Navigation Structure

**Primary navigation (left sidebar or top bar):**
CRMs typically use a persistent left sidebar with icon + label navigation. The most common top-level sections are:

- Dashboard (home)
- Contacts / People
- Companies / Accounts
- Deals / Pipeline
- Tasks / Activities
- Calendar
- Quotes / Proposals
- Invoices
- Reports / Analytics
- Inventory (if applicable)
- Settings

**Why left sidebar dominates:**
- Always visible, never hidden
- Scales well as features grow (just add more items)
- Can collapse to icons only on smaller screens
- Works on both desktop and tablet

**Secondary navigation:**
Within each section, use tabs or segmented controls. For example, within Contacts: "All Contacts" | "My Contacts" | "Unassigned" | "Recently Added"

---

### 3.2 The Contact Record (Detail Page)

This is the most visited page in any CRM. Get this right and everything else feels right.

**Layout pattern (widely adopted):**

```
┌──────────────────────────────────────────────────────────────┐
│  [← Back to Contacts]                        [Edit] [More ▾] │
│                                                               │
│  ┌─────────────────────┐  ┌────────────────────────────────┐ │
│  │ CONTACT HEADER      │  │ ACTIVITY TIMELINE              │ │
│  │                     │  │                                │ │
│  │ John Smith          │  │ [Add Note] [Log Call] [Email]  │ │
│  │ 📞 555-123-4567     │  │ [Schedule Task]                │ │
│  │ ✉️ john@email.com   │  │                                │ │
│  │ 📍 123 Oak Lane     │  │ ┌──────────────────────────┐  │ │
│  │                     │  │ │ Feb 24 - Quote sent       │  │ │
│  │ Owner: Mike S.      │  │ │ $59.99/mo - Pro Plan      │  │ │
│  │ Source: Google Ads   │  │ └──────────────────────────┘  │ │
│  │ Created: Jan 15      │  │ ┌──────────────────────────┐  │ │
│  │                     │  │ │ Feb 20 - Site visit       │  │ │
│  ├─────────────────────┤  │ │ Assessed 3BR home, needs  │  │ │
│  │ DEALS               │  │ │ 4 cameras + panel         │  │ │
│  │ ┌─────────────────┐ │  │ └──────────────────────────┘  │ │
│  │ │ Pro Security     │ │  │ ┌──────────────────────────┐  │ │
│  │ │ $2,159 | Quote   │ │  │ │ Feb 18 - Phone call      │  │ │
│  │ │ Sent             │ │  │ │ Discussed needs, booked   │  │ │
│  │ └─────────────────┘ │  │ │ site visit for Thursday   │  │ │
│  ├─────────────────────┤  │ └──────────────────────────┘  │ │
│  │ UPCOMING TASKS      │  │                                │ │
│  │ ☐ Follow up on      │  │ ┌──────────────────────────┐  │ │
│  │   quote (Feb 27)    │  │ │ Feb 15 - Lead received    │  │ │
│  ├─────────────────────┤  │ │ Google Ads - Dallas       │  │ │
│  │ CONTRACTS           │  │ │ Campaign                  │  │ │
│  │ (none yet)          │  │ └──────────────────────────┘  │ │
│  ├─────────────────────┤  │                                │ │
│  │ INVOICES            │  │                                │ │
│  │ (none yet)          │  │                                │ │
│  └─────────────────────┘  └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Left column: static info (who they are, related records)
- Right column: dynamic info (what's happened, in reverse chronological order)
- Quick-action buttons always visible at the top of the timeline
- Related records (deals, contracts, invoices) are summaries with click-through links
- The timeline is the heartbeat of the contact record

---

### 3.3 The Pipeline View (Kanban Board)

**Layout pattern:**

```
┌──────────────────────────────────────────────────────────────┐
│  Pipeline: Sales  ▾    Filter: All Reps ▾    This Month ▾    │
│                                                               │
│  New Lead    Contacted   Quote Sent   Negotiation   Won       │
│  $12,400     $8,200      $15,600      $4,800        $22,100   │
│  (8 deals)   (5 deals)   (4 deals)    (2 deals)    (6 deals) │
│  ─────────   ─────────   ──────────   ──────────   ────────── │
│  ┌────────┐  ┌────────┐  ┌─────────┐  ┌─────────┐ ┌────────┐ │
│  │J. Smith│  │M. Lee  │  │R. Chen  │  │T. Park  │ │A. Davis│ │
│  │$2,159  │  │$1,800  │  │$3,200   │  │$2,400   │ │$4,100  │ │
│  │3 days  │  │1 day   │  │⚠️ 7 days│  │2 days   │ │Today   │ │
│  └────────┘  └────────┘  └─────────┘  └─────────┘ └────────┘ │
│  ┌────────┐  ┌────────┐  ┌─────────┐  ┌─────────┐ ┌────────┐ │
│  │B. Jones│  │K. Wu   │  │P. Adams │  │         │ │L. Tran │ │
│  │$1,440  │  │$2,100  │  │$5,400   │  │         │ │$3,600  │ │
│  │1 day   │  │4 days  │  │2 days   │  │         │ │Today   │ │
│  └────────┘  └────────┘  └─────────┘  └─────────┘ └────────┘ │
│                                                               │
│  Drag cards between columns to update stage                   │
└──────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Column headers show stage name, total value, and deal count
- Cards show contact name, deal value, and days in stage
- Warning indicators for stale deals (7+ days in a stage, configurable)
- Drag-and-drop between columns updates the deal stage
- Click on card opens a slide-out panel (not a full page navigation) so you stay in context
- Filters for rep, date range, deal source, value range
- Toggle between kanban and list/table view

---

### 3.4 The Dashboard

**Layout pattern:**

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard                    This Month ▾   All Reps ▾      │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │  Revenue      │ │  Deals Won   │ │  MRR          │        │
│  │  $22,100      │ │  6           │ │  $8,450       │        │
│  │  ↑ 14% vs     │ │  ↑ 2 vs      │ │  ↑ $540 vs    │        │
│  │  last month   │ │  last month  │ │  last month   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                               │
│  ┌────────────────────────────┐ ┌────────────────────────┐   │
│  │  Pipeline by Stage          │ │  Revenue Over Time     │   │
│  │  [horizontal bar chart]     │ │  [line chart, 6 months]│   │
│  │                             │ │                        │   │
│  │  New Lead     ████ $12.4K   │ │                        │   │
│  │  Contacted    ███ $8.2K     │ │                        │   │
│  │  Quote Sent   █████ $15.6K  │ │                        │   │
│  │  Negotiation  ██ $4.8K      │ │                        │   │
│  └────────────────────────────┘ └────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────┐ ┌────────────────────────┐   │
│  │  Lead Sources               │ │  Rep Leaderboard       │   │
│  │  [pie or donut chart]       │ │  1. Mike S.  $8,200    │   │
│  │                             │ │  2. Sarah T. $6,400    │   │
│  │  Google Ads  42%            │ │  3. Jake R.  $4,100    │   │
│  │  Referrals   28%            │ │  4. Amy L.   $3,400    │   │
│  │  Door-to-door 18%          │ │                        │   │
│  │  Website     12%            │ │                        │   │
│  └────────────────────────────┘ └────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Recent Activity                                      │    │
│  │  Mike S. closed deal "Chen Residence" for $3,200      │    │
│  │  Sarah T. sent quote to Park family - $2,400          │    │
│  │  New lead from Google Ads: Bob Johnson, 555-0199      │    │
│  │  ⚠️ Payment failed: Davis contract - Visa ending 4242 │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Top row: 3-4 KPI cards with current value and trend vs. prior period
- Middle: 2-column grid of charts
- Bottom: Activity feed showing real-time team activity
- Everything is clickable (click a chart segment to drill into the underlying data)
- Date range and rep filters affect all widgets simultaneously
- Dashboard should be role-aware (owner/manager sees everything, rep sees their own)

---

### 3.5 List/Table Views

Used throughout the CRM for contacts, deals, invoices, tasks.

**Layout pattern:**

```
┌──────────────────────────────────────────────────────────────┐
│  Contacts (247)    [+ Add Contact]    [Import]   [Export]     │
│                                                               │
│  Search: [_______________]   Filter: [Source ▾] [Tag ▾]      │
│                                                               │
│  ☐  Name           Email              Phone        Source     │
│  ─────────────────────────────────────────────────────────── │
│  ☐  John Smith     john@email.com     555-1234    Google     │
│  ☐  Mary Lee       mary@email.com     555-5678    Referral   │
│  ☐  Robert Chen    rob@email.com      555-9012    Website    │
│  ☐  Tanya Park     tanya@email.com    555-3456    Door       │
│                                                               │
│  Showing 1-25 of 247    [< Prev]  1  2  3  ...  10  [Next >]│
└──────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Sortable columns (click header to sort)
- Bulk selection checkboxes for mass actions (assign, tag, delete, export)
- Inline search with instant filtering
- Filters that can be combined (source = Google AND tag = "hot lead")
- Saved filters / views ("My open leads", "Uncontacted this week")
- Pagination, not infinite scroll (users need to know the scope)
- Click a row to open the record, don't require a specific "view" button
- Column customization (show/hide columns, reorder)

---

### 3.6 Forms & Data Entry

The most common source of CRM frustration.

**Key principles:**
- Only ask for what's required. Every unnecessary field is friction.
- Group related fields visually (personal info, address, deal info)
- Use progressive disclosure: show basic fields first, "show more" for advanced
- Inline validation (don't wait until submit to tell them the phone number is wrong)
- Auto-format inputs (phone numbers, zip codes)
- Smart defaults (today's date, logged-in user as owner)
- Auto-save or at minimum a clear unsaved changes indicator
- Ability to add custom fields without developer involvement

---

### 3.7 Slide-Out Panels (Drawers)

One of the most important patterns in modern CRMs.

**When to use:**
- Viewing or editing a record while staying in context (e.g., clicking a deal card in pipeline view)
- Quick-add forms (new contact, new task)
- Activity logging

**Why it matters:**
Full page navigation is disorienting in a CRM. If a user is looking at their pipeline and clicks a deal, sending them to a new page means they lose their place. A slide-out panel (typically from the right side, 40-60% of screen width) shows the detail while keeping the pipeline visible behind it. Close the panel, and they're right where they were.

---

### 3.8 Notifications & Alerts

**Types:**
- In-app notifications (bell icon with unread count)
- Email notifications (configurable per event type)
- Push notifications on mobile
- SMS alerts (for urgent events like failed payments)

**What should trigger notifications:**
- New lead assigned to you
- Deal stage changed
- Task due today / overdue
- Payment received / failed
- Quote viewed by customer
- Upcoming appointment reminder
- Team @mention

**Key principle:** Let users control their notification preferences. Some people want everything, others want minimal interruption.

---

### 3.9 Search

**Global search is critical.** Users should be able to hit a keyboard shortcut (Cmd+K or /) and search across contacts, deals, companies, invoices, and tasks from one search bar. Results should be categorized by type and show enough context to pick the right one.

```
┌──────────────────────────────────────┐
│  🔍 john                              │
│                                       │
│  CONTACTS                             │
│  John Smith - 555-123-4567           │
│  Johnny Walker - 555-999-8888        │
│                                       │
│  DEALS                                │
│  Johnson Residence - $3,200          │
│                                       │
│  INVOICES                             │
│  INV-2025-0018 - John Smith - $59.99 │
└──────────────────────────────────────┘
```

---

### 3.10 Mobile Considerations

For field-based businesses (like home security), mobile is not optional.

**What field reps need on mobile:**
- View today's schedule and appointments
- Get directions to next appointment (one tap to maps)
- View contact details before arriving
- Log a call or note quickly
- Complete a task
- Take and attach a photo (job site, equipment installed)
- Create a quick contact from a business card or conversation
- View inventory in their truck

**What they don't need on mobile:**
- Complex report building
- Bulk data operations
- Admin/settings

**Key principles:**
- Touch targets: minimum 44x44px
- Thumb-friendly action buttons at bottom of screen
- Offline capability for areas with poor signal
- Minimal typing (dropdowns, toggles, voice-to-text for notes)
- Fast load times (field reps are impatient, they're standing at someone's door)

---

## Part 4: UX Principles That Make or Break a CRM

### 4.1 Reduce Clicks to Value

Every extra click is a chance for the user to give up. The most frequent actions should be reachable in 1-2 clicks from anywhere:
- Log a call: 1 click from contact record
- Add a task: 1 click from contact or deal
- Move a deal stage: 1 drag-and-drop
- Search for anything: 1 keyboard shortcut

### 4.2 Show, Don't Tell

Instead of making users dig for information, surface it proactively:
- Show a "stale deal" warning instead of making them run a report
- Show "last contacted 14 days ago" on a contact instead of making them check the timeline
- Show a red badge on the pipeline column where deals are dying

### 4.3 Context Is Everything

Never make the user leave their current context to get related information:
- Hovering over a contact name in a table should show a popover with key details
- Clicking a deal in pipeline opens a slide-out, not a new page
- The contact record shows related deals, invoices, and tasks inline

### 4.4 Forgiving Input

Users will enter data inconsistently. Handle it gracefully:
- Phone: "555-123-4567", "(555) 123-4567", "5551234567" should all normalize to the same format
- Names: handle case inconsistencies
- Dates: accept "next Tuesday", "3/15", "March 15" etc. where possible
- Search: fuzzy matching, typo tolerance

### 4.5 Empty States Matter

When a section has no data yet, don't show a blank screen. Show:
- A friendly message explaining what this section is for
- A clear call to action ("Add your first contact", "Create a deal")
- Optionally, sample data or a quick video walkthrough

### 4.6 Onboarding Flow

CRM abandonment is highest in the first week. A guided onboarding should:
1. Create your company profile
2. Add your first contact
3. Create your first deal
4. Customize your pipeline stages
5. Connect your email / calendar
6. Invite your team

Use a checklist with progress tracking. Celebrate completion of each step.

### 4.7 Speed and Performance

CRMs deal with potentially large datasets. Performance is a feature:
- Tables should render instantly up to 1,000 rows
- Search results should appear as you type (debounced 200-300ms)
- Pipeline board should animate smoothly on drag
- Dashboard should load in under 2 seconds
- Lazy load heavy components (charts, timelines with 100+ items)

### 4.8 Keyboard Shortcuts

Power users live in the CRM all day. Give them shortcuts:
- Cmd+K or /: Global search
- N: New contact
- D: New deal
- T: New task
- E: Edit current record
- Esc: Close panel/modal

### 4.9 Undo, Not Confirm

Instead of "Are you sure?" dialogs everywhere, let users do things quickly and provide an undo option. Moved a deal to the wrong stage? Toast notification: "Deal moved to Negotiation. [Undo]" with a 5-second window.

### 4.10 Progressive Disclosure

Don't overwhelm new users with every feature on day one:
- Start with the basics (contacts, deals, tasks)
- Unlock advanced features as they're needed (automation, custom reports, inventory)
- Settings should have sensible defaults that work out of the box
- Advanced options hidden behind "Advanced" toggles or sections

---

## Part 5: CRM Competitive Landscape (Reference)

### Major Players

| CRM | Target Market | Strengths | Weaknesses | Pricing |
|-----|--------------|-----------|------------|---------|
| Salesforce | Enterprise | Infinitely customizable, massive ecosystem | Complex, expensive, steep learning curve | $25-300+/user/mo |
| HubSpot | SMB to mid-market | Great free tier, excellent UX, marketing integration | Expensive at scale, less customizable | Free - $150/user/mo |
| Pipedrive | SMB sales teams | Best pipeline UX, simple and focused | Limited beyond sales, weak reporting | $14-99/user/mo |
| Zoho CRM | SMB | Feature-rich, affordable | Dated UI, can feel overwhelming | Free - $65/user/mo |
| Close | SMB sales teams | Built-in calling, email, SMS | Limited beyond sales | $49-139/user/mo |
| Freshsales | SMB | AI features, good UX, affordable | Less established ecosystem | Free - $69/user/mo |
| Monday CRM | SMB to mid-market | Visual, flexible, work management roots | Less "CRM-native" feel | $12-28/seat/mo |
| Copper | Small teams using Google | Deep Gmail/Workspace integration | Limited outside Google ecosystem | $23-134/user/mo |

### Industry-Specific (Home Security)

| CRM | Notes |
|-----|-------|
| FillQuick | Your friend's current CRM. Designed by former ADT dealer. Small team (6 devs), ~650 dealers. |
| SecurityTrax | Owned by Alarm.com. Becoming the "official" CRM for Alarm.com dealers. |
| Engarde | Older security dealer CRM, also integrates with ADT. |
| FieldPulse | Field service CRM, not security-specific but used by some. |
| ServiceTitan | Big player in home services (HVAC, plumbing) but overkill for security. |

---

## Part 6: What Your CRM Should Prioritize

Based on everything we've discussed about your friend's pain points and the product opportunity, here's what matters most, in priority order:

1. **Pipeline management** with clean kanban UX (this is the "wow" moment)
2. **Lead ingestion** from Google/Facebook/web with zero manual entry
3. **Contact management** with full activity timeline
4. **Recurring revenue tracking** (MRR, churn, contract health)
5. **Invoicing** that actually reaches the customer
6. **Payment processor integration** (Stripe + Authorize.net)
7. **Task and calendar management** with Google/Outlook sync
8. **Dashboard with real KPIs** (not vanity metrics)
9. **Inventory tracking** for equipment
10. **Mobile experience** for field reps and techs

The first 4 solve the immediate pain. The next 3 make it sticky. The last 3 make it a product.
