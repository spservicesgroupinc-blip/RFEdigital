# FolioPress Next Milestones — Task Checklist

## Phase 1: Foundation — Pages, Assets & Cost Tracking

- [ ] **Task 1:** Add page-level metadata to assets (`role`, `layoutPreset`, `pageText`) and API/UI updates
- [ ] **Task 2:** Add AI cost logging (`CostRecord`, write on every AI call, show totals in UI)

## Phase 2: AI Quality — Raster Images & Vision

- [ ] **Task 3:** Implement raster illustration generation (PNG via OpenRouter/Gemini image models)
- [ ] **Task 4:** Build a Reference Vault with AI vision summaries (asset tags + pinned references)

## Phase 3: Print-Ready Export

- [ ] **Task 5:** Add interior layout presets and on-canvas bleed/safe-margin guides
- [ ] **Task 6:** Add KDP cover wrap calculator and export
- [ ] **Task 7:** Add DPI preflight and seller pack generator (keywords, blurb, BISAC, Etsy tags, ZIP)

## Phase 4: Multi-Product Expansion

- [ ] **Task 8:** Coloring-book line-art mode and deterministic puzzle generators (maze, word search, cryptogram)
- [ ] **Task 9:** Wall-art multi-ratio exporter and flashcards layout

## Phase 5: Background Automation

- [ ] **Task 10:** Build Google Apps Script batch bridge (token auth + 5-min time-driven trigger)

---

## Checkpoints

- [ ] **Checkpoint 1:** After Phase 1 — `tsc --noEmit` passes, workspace loads, cost logging works
- [ ] **Checkpoint 2:** After Phase 2 — PNG illustrations and reference vision summaries work
- [ ] **Checkpoint 3:** After Phase 3 — KDP interior + cover PDFs and seller pack ZIP ready
- [ ] **Checkpoint 4:** After Phase 4 — Coloring-book and wall-art exports work
- [ ] **Checkpoint 5:** After Phase 5 — Apps Script bridge processes jobs unattended
