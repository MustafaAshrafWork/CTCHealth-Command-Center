# F14 — Contained horizontal scroll + Excel-style resizable columns + Gantt sizing

## Goal
Stop the /projects and /timeline pages from blowing the page width; add Excel-style column
resizing (drag + double-click auto-fit, persisted); shrink the Gantt axis to a focused
recent-12-month window with a Fit-all toggle and today centered ~1/3 from the left.

## Checklist
- [ ] layout.tsx: add `min-w-0` to flex-1 column + `overflow-x-hidden` on main
- [ ] timeline/page.tsx: drop duplicate `p-6` in wrapper div
- [ ] gantt-chart.tsx: MONTH_MIN_PX 60→48, TRACK_MIN_PX 900→600, focused-axis window with toggle, today-scroll to 1/3, bar clipping at axis edges
- [ ] projects-table.tsx: TanStack column sizing, resize handle, double-click auto-fit, localStorage persistence, table-layout fixed, colgroup widths
- [ ] columns.tsx: per-column size/minSize/enableResizing; title attrs for truncation
- [ ] Gates: `npm run build && npm run lint && npm run test`

## Decisions
- Test env is node-only (no jsdom) — no component tests added; rely on build + lint gates.
- Persist key: `cc.projects.columnSizing.v1` (per brief).
- Auto-fit: measure scrollWidth of existing <td>/<th> for the column, clamp to [minSize, 600].
- Resize handle is a div absolutely positioned at the right edge of each resizable header cell.

## Current state
DONE. Gates pass.

## Next steps
Implement files in order above; run gates; report.

## Blockers
None.