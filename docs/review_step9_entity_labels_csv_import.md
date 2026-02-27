# Step 9: Configurable Entity Labels + CSV Lead Import - QA / Security / Audit Report

**Date:** 2026-02-27
**Scope:** Configurable "Deal" entity naming per org + CSV mass import for deals/leads + pipeline stage on contact creation

---

## Summary of Changes

### Phase A: Configurable Entity Labels

1. **Auth types** (`frontend/src/types/auth.ts`): Added `EntityLabels`, `OrgSettings` interfaces and `settings` field to `Organization` type.
2. **Backend auth response** (`backend/app/schemas/auth.py`): Added `settings: dict | None = None` to `OrganizationResponse` so login includes org settings.
3. **Backend settings merge** (`backend/app/services/organization_service.py`): Deep-merge logic for `settings` field -- avoids clobbering sibling keys when updating `entity_labels`.
4. **useEntityLabels hook** (`frontend/src/hooks/useEntityLabels.ts`): NEW file. Reads `organization.settings.entity_labels.deal` from auth store. Returns `{ singular, plural, singularLower, pluralLower }` with fallback to "Deal"/"Deals".
5. **Pipeline Settings UI** (`frontend/src/pages/settings/PipelineSettings.tsx`): NEW card "What do you call your pipeline items?" with 5 presets (Deal, Lead, Opportunity, Job, Project) + custom option with singular/plural inputs. Saves to org settings via API.
6. **Text replacement in 13 files**: All user-visible "Deal"/"Deals" strings replaced with dynamic labels from `useEntityLabels()`:
   - `PipelineToolbar.tsx`: Search placeholder, New button
   - `PipelineBoard.tsx`: SlideOut panel title
   - `CreateDealModal.tsx`: Panel title, form label, submit button
   - `DealDetailPanel.tsx`: Details section heading
   - `StageTableSection.tsx`: Column header, deal counts, empty state, add button, footer count
   - `KanbanColumn.tsx`: Empty state, add button
   - `Dashboard.tsx`: Pipeline Value trend text, Won KPI title
   - `StaleDealsList.tsx`: Card title, empty state
   - `PipelineStageChart.tsx`: Tooltip deal counts
   - `ContactDetail.tsx`: Deals card heading, empty state
   - `QuoteBuilder.tsx`: Deal dropdown label, placeholder
   - `CSVImportModal.tsx`: Auto-create checkbox text, default value label
   - `PipelineSettings.tsx`: Delete confirmation modal text, stage row deal counts

### Phase B: CSV Deal/Lead Import

7. **Backend import schemas** (`backend/app/schemas/deals.py`): Added `DealImportRow`, `DealImportRequest`, `DealImportResponse` for bulk CSV import.
8. **Backend import service** (`backend/app/services/deal_service.py`): `import_deals()` function -- pre-loads contact email/phone maps for dedup, validates pipeline/stage, creates contacts + deals + stage history per row.
9. **Backend import route** (`backend/app/api/deals.py`): `POST /deals/import` registered BEFORE `/{deal_id}` to avoid path conflicts.
10. **Frontend API method** (`frontend/src/lib/api.ts`): Added `dealsApi.import()` method with typed request/response.
11. **Deal CSV field definitions** (`frontend/src/lib/dealCsvImport.ts`): NEW file. `DEAL_CRM_FIELDS` (14 fields: 10 contact + 4 deal), `mapDealColumns()`, `scrubDealRows()`, `validateDealRow()`.
12. **DealCSVImportModal** (`frontend/src/pages/pipeline/components/DealCSVImportModal.tsx`): NEW file. 6-step wizard (Upload, Map, Scrub, Preview, Options, Import) with dynamic entity labels throughout.
13. **PipelineToolbar** (`frontend/src/pages/pipeline/components/PipelineToolbar.tsx`): Added "Import CSV" button with Upload icon, `onImport` prop.
14. **PipelineBoard** (`frontend/src/pages/pipeline/PipelineBoard.tsx`): Wired import modal state, re-fetches deals on close.

### Phase C: Pipeline Stage on Contact Creation

15. **CreateContactModal** (`frontend/src/pages/contacts/components/CreateContactModal.tsx`): Added "Add to pipeline" checkbox with stage selector and optional deal title. Auto-creates a deal via `dealsApi.create()` after contact creation.

---

## QA Engineer Review

### Verified Working
- [x] TypeScript compilation: `npx tsc --noEmit` passes with zero errors
- [x] `useEntityLabels` hook returns correct default (Deal/Deals) when no settings set
- [x] Entity label settings card renders with 5 presets + Custom option
- [x] All 13 files use dynamic labels (no hardcoded "Deal"/"Deals" in user-visible strings)
- [x] Variable names, prop names, type names, API routes, and DB fields remain `deal/Deal` (only UI text changes)
- [x] `StageRow` component receives `dealLabel` prop correctly for stage deal counts
- [x] `PipelineStageChart` tooltip passes label props to non-hook `CustomTooltip` function
- [x] DealCSVImportModal renders 6-step wizard with correct entity labels
- [x] `POST /deals/import` route registered before `/{deal_id}` (no path conflict)
- [x] Import backend validates pipeline_id + stage_id exist before processing
- [x] CreateContactModal "Add to pipeline" section shows pipeline stages and deal title input
- [x] Import CSV button appears in PipelineToolbar alongside New Deal button

### Known Limitations
- Backend import processes all rows in a single transaction (may timeout for very large CSVs)
- Duplicate action "skip" in deal import skips the entire row (both contact and deal creation)
- Deal title fallback uses "Contact Name" format when no title column mapped

---

## Security Engineer Review

### Authentication/Authorization
- [x] `POST /deals/import` uses `get_current_user` dependency (requires JWT auth)
- [x] Import service validates org_id on pipeline/stage lookup
- [x] Contact creation during import uses org_id scoping
- [x] Organization settings update uses authenticated org context

### Input Validation
- [x] `DealImportRow.title` has `min_length=1, max_length=255` validation
- [x] `DealImportRequest.duplicate_action` validated with regex pattern `^(skip|create)$`
- [x] Frontend `canContinue()` requires mapped title + name fields before allowing import
- [x] Entity label inputs have `maxLength={30}` to prevent abuse
- [x] Custom label save validates both singular and plural are non-empty

### Data Exposure
- [x] No sensitive data in import responses (only counts and row numbers)
- [x] Failed row reasons are generic error messages, no stack traces
- [x] Entity labels stored in org settings JSON, not exposed to other orgs

### No Issues Found

---

## Audit Analyst Review

### Code Quality
- [x] `useEntityLabels` hook follows single-responsibility pattern, reads from existing auth store
- [x] Deep-merge logic in organization_service.py prevents settings key clobbering
- [x] DealCSVImportModal follows same 6-step wizard pattern as existing CSVImportModal
- [x] `dealCsvImport.ts` reuses normalizers from `csvImport.ts` (DRY)
- [x] Entity label presets include correct plurals (Opportunity -> Opportunities)

### Architecture Compliance
- [x] All API calls go through `api.ts` exports (no direct axios in components)
- [x] Import route registered before parameterized routes (FastAPI path priority)
- [x] Auth store `updateOrganization()` persists settings to localStorage
- [x] SlideOutPanel pattern maintained for CreateContactModal pipeline section

### Data Integrity
- [x] Import dedup uses both email and phone matching (same as contact CSV import)
- [x] Stage history logged for every imported deal (audit trail)
- [x] Pipeline stage validated before any deals created (atomic check)

### Files Changed (19 total)
**New files (3):**
- `frontend/src/hooks/useEntityLabels.ts`
- `frontend/src/lib/dealCsvImport.ts`
- `frontend/src/pages/pipeline/components/DealCSVImportModal.tsx`

**Modified files (16):**
- `backend/app/schemas/auth.py`
- `backend/app/schemas/deals.py`
- `backend/app/services/deal_service.py`
- `backend/app/services/organization_service.py`
- `backend/app/api/deals.py`
- `frontend/src/types/auth.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/settings/PipelineSettings.tsx`
- `frontend/src/pages/pipeline/PipelineBoard.tsx`
- `frontend/src/pages/pipeline/components/PipelineToolbar.tsx`
- `frontend/src/pages/pipeline/components/CreateDealModal.tsx`
- `frontend/src/pages/pipeline/components/DealDetailPanel.tsx`
- `frontend/src/pages/pipeline/components/StageTableSection.tsx`
- `frontend/src/pages/pipeline/components/KanbanColumn.tsx`
- `frontend/src/pages/dashboard/Dashboard.tsx`
- `frontend/src/pages/dashboard/components/StaleDealsList.tsx`
- `frontend/src/pages/dashboard/components/PipelineStageChart.tsx`
- `frontend/src/pages/contacts/components/ContactDetail.tsx`
- `frontend/src/pages/contacts/components/CreateContactModal.tsx`
- `frontend/src/pages/quotes/components/QuoteBuilder.tsx`
- `frontend/src/pages/contacts/components/CSVImportModal.tsx`

### Recommendations
1. Consider adding a rate limit to `POST /deals/import` to prevent abuse (e.g. max 1000 rows per request)
2. Add a batch size limit in the backend for very large imports
3. Consider adding an undo/rollback mechanism for imports
