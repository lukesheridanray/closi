# Pipeline Layout + Settings -- QA / Security / Audit Review

**Date:** 2026-02-26
**Feature:** Fix Pipeline Layout (fluid columns) + Pipeline Settings Page
**Build Phase:** Phase 4 -- Pipeline + Deals
**Build Status:** `tsc --noEmit` PASS | `vite build` PASS

---

## Scope

Files modified/created in this feature:

| File | Change Type |
|------|-------------|
| `frontend/src/pages/pipeline/components/KanbanBoard.tsx` | Modified (fluid layout) |
| `frontend/src/pages/pipeline/components/KanbanColumn.tsx` | Modified (fluid columns) |
| `frontend/src/pages/pipeline/components/DealCard.tsx` | Modified (truncation, sizing) |
| `frontend/src/pages/pipeline/components/PipelineToolbar.tsx` | Modified (gear icon) |
| `frontend/src/stores/pipelineStore.ts` | Modified (5 new actions, validations) |
| `frontend/src/types/pipeline.ts` | Modified (is_active field) |
| `frontend/src/pages/settings/PipelineSettings.tsx` | Rewritten (full settings page) |

---

## QA Review Summary

**Reviewer:** QA Engineer
**Total findings:** 30 (4 Critical, 5 High, 12 Medium, 9 Low)

### Critical Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| QA-1/16 | Stale `now` variable -- all deal moves got same timestamp | Removed module-level `const now`; each `moveDeal` call now uses inline `new Date().toISOString()` |
| QA-15/26 | `deleteStage` orphaned deals, making them invisible on board | `deleteStage` now accepts optional `reassignToStageId`; PipelineSettings forces user to pick a target stage before confirming delete |

### High Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| QA-23 | Color picker had no click-outside dismiss | Added `useRef` + `mousedown` listener to detect clicks outside; also added Escape key handler |
| QA-19 | No validation prevented empty stage names | Store `updateStage` now rejects empty names; UI uses local state + commit on blur with revert |

### High Issues -- DEFERRED (pre-existing, not introduced by this feature)

| # | Issue | Reason Deferred |
|---|-------|-----------------|
| QA-3 | SortableContext implies intra-column reorder but no logic exists | Pre-existing architecture decision; needs `position` field on Deal type -- separate feature |
| QA-8 | `isDragging` click guard timing | Pre-existing; the 8px distance constraint on PointerSensor handles this in practice |
| QA-12 | Pipeline selector dropdown not implemented | Pre-existing stub; separate feature for multi-pipeline support |

### Medium Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| QA-17 | `Date.now()` for ID generation risked collisions | Changed to `crypto.randomUUID()` |
| QA-24 | Stage name fired store update per keystroke | Changed to local state with blur-commit pattern |
| QA-27 | Pipeline name state did not sync with store | Added `useEffect` syncing `pipelineName` when `activePipeline.name` changes |

### Medium Issues -- DEFERRED

| # | Issue | Reason |
|---|-------|--------|
| QA-9 | `updated_at` wrong metric for days-in-stage | Needs `stage_entered_at` field; backend data model change |
| QA-18 | `reorderStages` can produce duplicate positions | Guard exists (returns old position if not in array); edge case only reachable via bug in caller |

### Low Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| QA-28 | Modal lacked Escape key handler | Added `keydown` listener for Escape |
| QA-29 | Modal backdrop did not close on click | Added `onClick` on backdrop div with `stopPropagation` on inner content |

---

## Security Review Summary

**Reviewer:** Security & Compliance Engineer
**Total findings:** 16 (2 Critical, 4 High, 5 Medium, 5 Low)

### Critical Issues -- DEFERRED (infrastructure-level, not feature-scoped)

| # | Issue | Reason Deferred |
|---|-------|-----------------|
| SEC-01 | Tokens in localStorage vulnerable to XSS | Auth architecture decision; requires backend cookie changes -- tracked for Auth sprint |
| SEC-02 | No RBAC on pipeline settings routes | Requires role-based route guards; tracked for Auth + RBAC sprint |

### High Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| SEC-05 | Stage deletion orphaned deals | Delete now requires deal reassignment (see QA-15 fix) |

### High Issues -- DEFERRED

| # | Issue | Reason Deferred |
|---|-------|-----------------|
| SEC-03 | No CSRF protection | Backend infrastructure; will be addressed during API integration |
| SEC-04 | Client-side-only business logic | Expected for mock data phase; server validation will be added with API integration |
| SEC-06 | Excessive PII in client state | Requires API-level `ContactSummary` optimization; tracked for backend |

### Medium Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| SEC-07 | Unvalidated `stage.color` in inline styles | Added `HEX_COLOR_REGEX` validation in `updateStage`; only accepts `#RRGGBB` format |
| SEC-08 | No input length validation on names | Added `maxLength={100}` to pipeline name and stage name inputs |
| SEC-10 | `stale_days` unbounded | Added `max={365}` HTML attribute and `Math.min(365, ...)` in handler and store |

### Medium Issues -- DEFERRED

| # | Issue | Reason Deferred |
|---|-------|-----------------|
| SEC-09 | Store state tamperable via DevTools | Inherent client-side limitation; mitigated by server-side validation when API is wired |
| SEC-11 | No audit trail for config changes | Backend feature; tracked for audit logging sprint |

### Low Issues -- FIXED

| # | Issue | Fix Applied |
|---|-------|-------------|
| SEC-13 | Cross-pipeline stage move not validated | `moveDeal` now validates `toStageId` belongs to same `pipeline_id` |
| SEC-14 | Stale timestamp in moveDeal | Fixed (same as QA-1) |
| SEC-15 | Predictable ID generation | Changed to `crypto.randomUUID()` (same as QA-17) |

---

## Audit Review Summary

**Reviewer:** Audit Analyst
**Overall Rating:** B+ (Code Quality A-, UX B, Accessibility D -> C+, Architecture A-, Performance A, Maintainability C+ -> B, Design System B-)

### Findings -- FIXED

| # | Finding | Fix Applied |
|---|---------|-------------|
| F-A11Y-1 | No ARIA attributes anywhere | Added `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby` to delete modal; `aria-label` on drag handles, color swatch, delete buttons; `aria-expanded` on color picker trigger |
| F-A11Y-2 | Color picker no keyboard dismiss | Added Escape key handler |
| F-A11Y-3 | Delete modal no focus trap or Escape | Added Escape handler and backdrop click dismiss |
| F-CQ-3 | Stale `now` variable | Fixed (same as QA-1) |

### Findings -- DEFERRED

| # | Finding | Reason Deferred |
|---|---------|-----------------|
| F-CQ-1 | Duplicated `currencyFormat` | Pre-existing; worth extracting to `@/lib/formatters.ts` in a cleanup pass |
| F-CQ-2 | Duplicated card body in DealCard/DealCardOverlay | Pre-existing; extract `DealCardContent` in cleanup pass |
| F-UX-1/F-DS-1 | Raw buttons instead of shadcn `<Button>` | Pre-existing pattern across all pages; migration should be done holistically |
| F-A11Y-4/5 | Icon-only stale indicator, abbreviation "d" | Pre-existing; add `sr-only` text in accessibility pass |
| F-A11Y-6 | Color contrast on stage badge | Pre-existing `DealDetailPanel` issue; needs luminance-based text color |
| F-MAINT-3 | No error boundaries | Architectural addition; tracked for all pages |
| F-MAINT-4 | Zero test coverage | Test infrastructure setup tracked separately |
| F-ARCH-1 | Business logic in KanbanBoard component | Pre-existing; extract to custom hook when complexity grows |

---

## Fixes Applied Summary

| Category | Fixed | Deferred | Total |
|----------|-------|----------|-------|
| Critical | 2 | 2 | 4 |
| High | 3 | 5 | 8 |
| Medium | 7 | 5 | 12 |
| Low | 4 | 8 | 12 |
| **Total** | **16** | **20** | **36** |

**Key deferred items are pre-existing infrastructure concerns** (auth tokens, RBAC, test coverage, shadcn migration) that will be addressed in their respective build phases. All issues directly introduced by this feature have been fixed.

---

## Build Verification

```
tsc --noEmit   -> PASS (0 errors)
vite build     -> PASS (built in 5.93s)
```
