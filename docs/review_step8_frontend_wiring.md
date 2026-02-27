# Step 8: Frontend Wiring - QA / Security / Audit Report

**Date:** 2026-02-27
**Scope:** Connect frontend pages to live backend API, fix data flow issues

---

## Summary of Changes

### Backend Fixes
1. **Pipeline endpoint** (`backend/app/api/pipelines.py`): Changed `GET /pipelines` to return `PipelineDetailResponse` (with embedded stages) instead of `PipelineResponse` (without stages).
2. **Pipeline service** (`backend/app/services/pipeline_service.py`): Added `list_pipelines_with_stages()` function that queries stages per pipeline.
3. **Subscription model** (`backend/app/models/subscription.py`): Made `contract_id` nullable for businesses that don't use contracts.
4. **Subscriptions API** (`backend/app/api/subscriptions.py`): NEW endpoint `GET /subscriptions` for listing subscriptions with pagination.
5. **Subscription schema** (`backend/app/schemas/subscriptions.py`): Made `contract_id` optional in `SubscriptionCreate` and `SubscriptionResponse` to match nullable model field.

### Frontend Fixes
1. **Pipeline store** (`frontend/src/stores/pipelineStore.ts`): Added parallel fetch of contacts alongside deals so pipeline views can show contact names.
2. **Pipeline toolbar** (`frontend/src/pages/pipeline/components/PipelineToolbar.tsx`): Wired `onNewDeal` prop to New Deal button.
3. **CreateDealModal** (`frontend/src/pages/pipeline/components/CreateDealModal.tsx`): New slide-out form for creating deals (name, contact dropdown, value, rep, stage, close date, notes).
4. **CreateContactModal** (`frontend/src/pages/contacts/components/CreateContactModal.tsx`): New slide-out form for creating contacts (name, email, phone, address, lead source, notes).
5. **Dashboard** (`frontend/src/pages/dashboard/Dashboard.tsx`): Replaced contract store dependency with `analyticsApi.getRecurringRevenue()` for MRR, ARPA, churn, and active customer KPIs.
6. **RepLeaderboard** (`frontend/src/pages/dashboard/components/RepLeaderboard.tsx`): Rewrote to fetch from `analyticsApi.getDashboard()` instead of hardcoded placeholder names.
7. **RecentActivityFeed** (`frontend/src/pages/dashboard/components/RecentActivityFeed.tsx`): Changed to fetch activities directly from `activitiesApi.list()` instead of empty contact store.
8. **SidebarPanel** (`frontend/src/components/layout/SidebarPanel.tsx`): Replaced skeleton placeholders with real activity feed (5 recent) and dashboard KPI metrics.
9. **Reports page** (`frontend/src/pages/reports/Reports.tsx`): Complete rewrite from contract store (empty) to use `analyticsApi.getRecurringRevenue()` for KPIs/trends and `subscriptionsApi.list()` for subscription table. Shows MRR, ARPA, churn rate, MRR trend chart, MRR waterfall, subscriber status breakdown, and active subscriptions table.
10. **Subscriptions API client** (`frontend/src/lib/api.ts`): Added `subscriptionsApi.list()` and `subscriptionsApi.get()`.
11. **Subscription type** (`frontend/src/types/contract.ts`): Added `Subscription` interface and `SubscriptionStatus` type.
12. **Vite config** (`frontend/vite.config.ts`): Updated proxy target to port 8003 (workaround for zombie processes on 8000-8002).

### Data Cleanup
- Removed 3 orphan "New Stage" entries from pipeline_stages table (created during testing).

---

## QA Engineer Review

### Verified Working
- [x] Login: `ethan@medleyandsons.com / Demo1234!` returns valid JWT
- [x] `GET /api/v1/pipelines` returns 1 pipeline with 10 stages (New Lead through Lost)
- [x] `GET /api/v1/deals?page_size=100` returns 26 deals with correct stage assignments
- [x] `GET /api/v1/contacts?page_size=100` returns 35 contacts
- [x] `GET /api/v1/activities?page_size=5` returns activities with type/subject/performed_at
- [x] `GET /api/v1/analytics/dashboard` returns KPIs (5), pipeline_by_stage, rep_leaderboard (3 reps)
- [x] `GET /api/v1/analytics/recurring-revenue` returns MRR=$579.88, 12 active subs, 6-month trend
- [x] `GET /api/v1/subscriptions?page_size=100` returns 12 subscriptions with amounts, intervals, next billing dates
- [x] `GET /api/v1/tasks?page_size=5` returns tasks
- [x] TypeScript compilation: zero errors
- [x] Vite proxy correctly forwards /api requests to backend on port 8003

### Known Issues
- Rep leaderboard shows $0 revenue for all reps (deals won in seed don't have `closed_at` in the 30-day window the analytics query checks)
- Dashboard "Deals Closed (30d)" shows 0 for same reason
- 3 extra pipeline stages were created during testing - cleaned up

---

## Security Engineer Review

### Authentication/Authorization
- [x] All API calls include JWT Bearer token via Axios interceptor
- [x] 401 responses trigger token refresh flow
- [x] No hardcoded tokens or credentials in frontend code
- [x] CreateDealModal and CreateContactModal use store methods that go through authenticated API calls

### Input Validation
- [x] CreateContactModal: first_name and last_name required, email type validated
- [x] CreateDealModal: title required, estimated_value is number input
- [x] All form data sent via JSON POST through authenticated API, no raw HTML injection paths

### Data Exposure
- [x] No sensitive data logged to console
- [x] Error handlers use `.catch(() => {})` pattern - no credential leaks on error
- [x] SidebarPanel fetches limited data (page_size=5 activities, KPIs only)

### No Issues Found

---

## Audit Analyst Review

### Code Quality
- [x] All new components follow existing project patterns (Zustand stores, SlideOutPanel, bottom-border inputs)
- [x] No hardcoded data remaining in dashboard components (RepLeaderboard, RecentActivityFeed, SidebarPanel)
- [x] Empty states handled with user-friendly messages ("No recent activity", "No rep data available")
- [x] TypeScript strict mode passes with zero errors

### Architecture Compliance
- [x] API calls follow established pattern: `api.ts` exports -> stores consume -> components render
- [x] No direct axios calls in components; all go through store or api module
- [x] SlideOutPanel used for create forms (consistent with existing ContactDetail, DealDetail patterns)

### Data Integrity
- [x] Pipeline stages cleaned from 13 to 10 (removed 3 test artifacts)
- [x] Subscription model `contract_id` nullable change is backwards-compatible and has migration

### Recommendations
1. Rep revenue calculation in analytics should consider all-time won deals, not just 30-day window
2. Consider adding loading states to SidebarPanel while data fetches
3. The 3 "New Stage" test artifacts suggest the stage creation endpoint needs rate limiting or admin-only access
