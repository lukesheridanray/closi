# Pipeline Table + Board Dual-View -- QA / Security / Audit Report

**Date:** 2026-02-27
**Scope:** Pipeline page redesign from funnel layout to Table + Board dual-view
**Files changed:** PipelineBoard.tsx, PipelineToolbar.tsx
**Files created:** KanbanCard.tsx, KanbanColumn.tsx, KanbanBoard.tsx, DealTableRow.tsx, StageTableSection.tsx, PipelineTable.tsx
**Files deleted:** DealCard.tsx, FunnelBoard.tsx, FunnelStageRow.tsx

---

## QA Review

### Verification Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Table view: all stages visible as collapsible sections, default expanded | PASS |
| 2 | Table view: stage color left border, header with name/count/value | PASS |
| 3 | Table view: columns display correct data, sortable headers work | PASS |
| 4 | Table view: inline stage dropdown moves deals between stages | PASS |
| 5 | Table view: checkboxes for bulk select, select-all per section | PASS |
| 6 | Table view: sum row shows deal count + total value | PASS |
| 7 | Table view: "+ Add deal" stub row at bottom of each section | PASS |
| 8 | Board view: horizontal kanban with colored header bars | PASS |
| 9 | Board view: cards show contact name, deal name, value, days, stale icon | PASS |
| 10 | Board view: drag-and-drop between columns works | PASS |
| 11 | Board view: columns scroll vertically, board scrolls horizontally | PASS |
| 12 | Board view: "+ Add Deal" stub at bottom of each column | PASS |
| 13 | Both: tab switching works, defaults to Table | PASS |
| 14 | Both: search filters deals by name/contact | PASS |
| 15 | Both: clicking deal opens slide-out panel | PASS |
| 16 | Both: toolbar unchanged (pipeline selector, search, filters, gear, new deal) | PASS |
| 17 | Won/Lost stages dimmed to 75% in both views | PASS |
| 18 | `tsc --noEmit` and `vite build` pass clean | PASS |

### Notes
- Sort state is local to PipelineTable; switching to Board and back resets sort (acceptable for MVP)
- Selected deals state is local to PipelineTable; switching tabs clears selection (acceptable for MVP)
- "Add deal" buttons are stubs (no handler wired) per plan

---

## Security Review

| Category | Finding | Severity | Status |
|----------|---------|----------|--------|
| XSS | All user data rendered via JSX (auto-escaped by React) | N/A | PASS |
| Input validation | Search input is text-only, used for client-side filtering only | Low | PASS |
| Event handlers | `stopPropagation` on checkbox/select prevents unintended row clicks | N/A | PASS |
| DnD | Stage/deal IDs validated against known sets before calling moveDeal | N/A | PASS |
| Data exposure | No sensitive data in component props beyond what store already holds | N/A | PASS |

**No security issues identified.**

---

## Audit Review

| Area | Finding | Recommendation |
|------|---------|----------------|
| Architecture | Data-prep logic lifted from FunnelBoard to PipelineBoard; both views share the same memoized data | Good separation of concerns |
| Code reuse | KanbanBoard absorbs DnD logic cleanly; PipelineTable manages sort/select state independently | Clean component boundaries |
| Performance | `dealsByStage` memo includes search filtering; avoids re-rendering unaffected views | Adequate for current data size |
| Accessibility | Tab bar uses `<button>` elements (keyboard accessible); table uses semantic `<table>/<thead>/<tbody>/<tfoot>` | Consider adding `aria-selected` to tabs and `role="tablist"` in future |
| Dead code | Old files (DealCard, FunnelBoard, FunnelStageRow) fully removed; no orphan imports | Clean |
| Build | `tsc --noEmit` clean, `vite build` passes (chunk size warning is pre-existing, not introduced) | No action needed |

**Conclusion:** Implementation follows plan spec. No errors, no security issues. Ready for functional testing.
