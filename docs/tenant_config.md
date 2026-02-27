# CLOSI Multi-Tenant Configuration & White-Label System

## How to use this file
Tell Claude Code: "Read docs/tenant_config.md and build the admin panel and tenant configuration system. This is the infrastructure that lets us deploy and manage CLOSI for multiple business clients."

---

## Part 1: LSRV Admin Panel (Super Admin)

Build a separate admin interface at /admin that is ONLY accessible by LSRV super admins (not client users). This is where Luke manages all client organizations.

### Super Admin Role

Add a new role: super_admin. This role exists outside of any organization. Super admins can see and manage ALL organizations.

Add to User model:
- is_super_admin (boolean, default false)

Super admin auth bypasses org_id scoping. They can switch between organizations freely.

### Admin Dashboard (/admin)

- Total organizations count
- Total users across all orgs
- Total MRR across all client subscriptions (what LSRV is billing)
- Total AI requests this month across all orgs
- List of all organizations with: name, plan tier, user count, created date, last active, status (active/suspended/trial)

### Organization Management (/admin/organizations)

List all organizations with search and filter. Click into any org to manage it.

Create New Organization form:
- Company name
- Company address (city, state)
- Primary contact name and email (this becomes the owner account)
- Plan tier: starter, pro
- Trial end date (optional)
- Send invite email toggle

Organization Detail view:
- All settings for this org (editable by super admin)
- User list with ability to create/deactivate users
- Feature toggles (see Part 3)
- Branding configuration (see Part 2)
- Integration status overview
- AI usage stats
- Activity: last login dates per user
- Billing info: plan, monthly amount, payment status
- "Login as" button: lets super admin impersonate any user in this org for support/debugging (clearly marked in UI with a banner "Viewing as [User Name] - [Org Name]")

### Quick Actions from Admin Panel:
- Create organization + owner in one step
- Bulk send invite emails
- Suspend/reactivate an organization
- Change plan tier
- Reset a user's password
- Trigger data export for an organization

---

## Part 2: White-Label Branding

Each organization can have custom branding that overrides the CLOSI defaults. This is configured by the super admin during onboarding OR by the client's owner in their settings.

### Branding Configuration

Add to Organization model (store as JSON field: branding_config):

```json
{
    "company_name": "Shield Home Security",
    "logo_url": "/uploads/orgs/shield/logo.svg",
    "logo_icon_url": "/uploads/orgs/shield/icon.svg",
    "primary_color": "#6C63FF",
    "primary_color_hover": "#5A52E0",
    "secondary_color": "#1A1A2E",
    "accent_color": "#059669",
    "sidebar_bg": "#FFFFFF",
    "sidebar_text": "#64748B",
    "nav_rail_bg": "#6C63FF",
    "nav_rail_icon_color": "#FFFFFF",
    "header_bg": "#FFFFFF",
    "font_family": "Inter",
    "border_radius": "8px",
    "favicon_url": "/uploads/orgs/shield/favicon.ico",
    "login_bg_image_url": null,
    "login_tagline": "Manage your security business",
    "email_header_color": "#6C63FF",
    "email_footer_text": "Shield Home Security LLC",
    "invoice_logo_url": "/uploads/orgs/shield/logo.svg",
    "invoice_company_info": "Shield Home Security LLC\n1234 Main St\nDallas, TX 75201\n(214) 555-0100"
}
```

### How Branding is Applied

Frontend loads branding config on app initialization via:
GET /api/v1/organization/branding (public endpoint, scoped by subdomain or org identifier)

Apply branding using CSS custom properties:

```css
:root {
    --color-primary: var(--brand-primary, #6C63FF);
    --color-primary-hover: var(--brand-primary-hover, #5A52E0);
    --color-secondary: var(--brand-secondary, #1A1A2E);
    --color-accent: var(--brand-accent, #059669);
    --sidebar-bg: var(--brand-sidebar-bg, #FFFFFF);
    --nav-rail-bg: var(--brand-nav-rail-bg, #6C63FF);
    --font-family: var(--brand-font, 'Inter');
    --border-radius: var(--brand-radius, 8px);
}
```

On load, inject the org's branding values into CSS variables. Every component already uses these variables from the design system, so the entire app re-themes automatically.

### Logo Handling

- Logo displayed in the nav rail (icon version, 32x32)
- Full logo on the login page
- Logo on PDF invoices and quotes
- Logo in email headers
- Favicon in browser tab
- Upload endpoint: POST /api/v1/organization/branding/logo (accepts SVG, PNG)
- Store in /uploads/orgs/[org_id]/ directory

### Branding Settings UI

For super admins: full branding editor in the admin panel org detail view.

For client owners: simplified "Company Branding" section in Settings:
- Upload logo
- Pick primary color (color picker)
- Pick accent color (color picker)
- Company name and tagline
- Invoice company info (address, phone)
- Preview button that shows a mini mockup of how the app looks with their colors

### Login Page Customization

Each organization gets a branded login page. The login page shows:
- Their logo (or CLOSI logo if not set)
- Their company name
- Their tagline
- Their primary color as the accent
- Their background image (optional)

Access via subdomain or URL path:
- shield.closicrm.com or closicrm.com/shield
- The login page detects the org from the URL and loads their branding

---

## Part 3: Feature Toggles

Not every client gets every feature. Feature access is controlled per organization based on their plan tier and custom configuration.

### Feature Flag System

Add to Organization model (JSON field: feature_flags):

```json
{
    "pipeline": true,
    "contacts": true,
    "tasks": true,
    "quotes": true,
    "contracts": true,
    "invoicing": true,
    "payments_stripe": true,
    "dashboard_basic": true,
    "dashboard_financial": false,
    "recurring_revenue_dashboard": false,
    "reports": false,
    "ai_daily_tasks": true,
    "ai_agent": false,
    "sms_twilio": false,
    "email_resend": true,
    "csv_import": true,
    "google_ads_integration": false,
    "facebook_integration": false,
    "generic_webhooks": false,
    "alarmcom_integration": false,
    "inventory": false,
    "calendar_sync": false,
    "api_access": false,
    "custom_fields": false,
    "bulk_actions": true,
    "export_data": true
}
```

### Default Feature Sets by Plan

Starter plan:
- pipeline, contacts, tasks, quotes, contracts, invoicing, dashboard_basic, dashboard_financial, recurring_revenue_dashboard, reports, csv_import, email_resend, bulk_actions, export_data, ai_daily_tasks, payments_stripe, sms_twilio, google_ads_integration, facebook_integration, generic_webhooks, calendar_sync

Pro plan (everything in starter plus):
- ai_agent, alarmcom_integration, inventory, api_access, custom_fields

Pro also includes custom analytics consulting from LSRV (handled outside the app).

Super admins can override any feature flag per org regardless of plan.

### How Feature Flags Work

Backend middleware: before processing any request, check if the feature flag for that endpoint's feature is enabled for the org. If not, return 403 with message: "This feature is not available on your current plan. Contact your administrator to upgrade."

Frontend: on app load, fetch feature flags via GET /api/v1/organization/features. Store in a Zustand store. Use a hook:

```typescript
const { isEnabled } = useFeatureFlags();

if (!isEnabled('ai_agent')) {
    // Don't render the AI chat button
}
```

### Sidebar Navigation Control

The sidebar nav items are dynamically shown/hidden based on feature flags:

```typescript
const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', feature: 'dashboard_basic' },
    { icon: Kanban, label: 'Pipeline', path: '/pipeline', feature: 'pipeline' },
    { icon: Users, label: 'Contacts', path: '/contacts', feature: 'contacts' },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks', feature: 'tasks' },
    { icon: Calendar, label: 'Calendar', path: '/calendar', feature: 'calendar_sync' },
    { icon: FileText, label: 'Quotes', path: '/quotes', feature: 'quotes' },
    { icon: FileSignature, label: 'Contracts', path: '/contracts', feature: 'contracts' },
    { icon: Receipt, label: 'Invoices', path: '/invoices', feature: 'invoicing' },
    { icon: Package, label: 'Inventory', path: '/inventory', feature: 'inventory' },
    { icon: BarChart3, label: 'Reports', path: '/reports', feature: 'reports' },
    { icon: Settings, label: 'Settings', path: '/settings', always: true },
];

// Only render items where feature is enabled or always is true
```

This means the sidebar automatically adjusts per client. A starter client sees 7 nav items. A pro client sees 10. Enterprise sees everything.

### Locked Feature UI

When a feature is disabled, don't just hide it completely. For key upgrade-worthy features, show the nav item but with a lock icon. When clicked, show a modal:

"[Feature Name] is available on the Pro plan. Contact your CLOSI representative to upgrade."

This creates upsell opportunities. The owner sees "Reports" in their sidebar with a lock, gets curious, and calls you to upgrade.

Configure which disabled features show as locked vs fully hidden:

```json
{
    "show_locked": ["ai_agent", "inventory", "alarmcom_integration", "api_access", "custom_fields"],
    "fully_hidden": []
}
```

---

## Part 4: Tenant URL Routing

Each organization accesses CLOSI via their own URL.

### Option A: Subdomain routing (preferred)
- shield.closicrm.com
- acme-security.closicrm.com
- Frontend detects subdomain, passes to backend
- Backend looks up org by subdomain slug

Add to Organization model: subdomain_slug (varchar, unique)

### Option B: Path-based routing (simpler for initial launch)
- closicrm.com/app/shield
- closicrm.com/app/acme-security

### Login Flow
1. User goes to shield.closicrm.com
2. App loads, detects subdomain "shield"
3. Fetches branding config for "shield" org
4. Shows branded login page
5. User logs in, JWT includes org_id
6. App loads with that org's feature flags and branding

---

## Part 5: Onboarding Checklist

When a super admin creates a new organization, auto-generate an onboarding checklist tracked in the admin panel:

- [ ] Organization created
- [ ] Owner account created and invite sent
- [ ] Logo uploaded
- [ ] Branding colors configured
- [ ] Pipeline stages customized
- [ ] Feature flags set for plan tier
- [ ] Existing customer data imported (CSV)
- [ ] Stripe connected
- [ ] Twilio configured (if on plan)
- [ ] Lead source webhooks configured (if on plan)
- [ ] Owner completed first login
- [ ] Walkthrough call scheduled
- [ ] Walkthrough call completed

Store as JSON on the Organization model: onboarding_checklist
Track completion percentage. Show in admin dashboard.

---

## Part 6: Client Settings Page

The client's own Settings page (accessible to owner/admin roles) should include:

Company Settings:
- Company name, address, phone, website
- Timezone
- Business hours

Branding (simplified):
- Upload logo
- Primary color picker
- Accent color picker
- Invoice company info

User Management:
- List users, invite new, deactivate, change roles

Pipeline Settings:
- Customize stages (already built)

Notification Preferences:
- Email notifications on/off per type
- SMS notifications on/off per type (if Twilio connected)

Integrations:
- Integration cards with connection status (already built)

AI Settings:
- AI daily task rules and thresholds (already built)
- AI agent API key (if self-hosted key)

Data:
- Export all data as CSV
- Import contacts

Billing (read-only):
- Current plan tier
- "Contact LSRV to upgrade" button

Things the client should NOT see or control:
- Feature flags (managed by super admin)
- Plan tier changes
- Super admin panel
- Other organizations
- Raw database access

---

## Build Order

1. Feature flag system (model, middleware, frontend hook, sidebar control)
2. Branding configuration (model, CSS variables, logo upload, login page)
3. Super admin role and admin panel
4. Organization management (create, edit, feature toggles, branding)
5. Subdomain/path routing for multi-tenant login
6. Onboarding checklist
7. Locked feature upsell modals
8. "Login as" impersonation for support

---

## Verify:
1. Create two test organizations with different plans
2. Verify starter org sees fewer sidebar items than pro org
3. Verify different branding (logo, colors) per org
4. Verify locked feature modal shows for disabled features
5. Verify super admin can switch between orgs
6. Verify super admin "login as" works with impersonation banner
7. Verify branding applies to login page, nav, invoices, emails
8. Verify feature flag middleware blocks API calls for disabled features
9. Verify onboarding checklist tracks progress
10. Verify one org cannot access another org's data
