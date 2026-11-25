# Simplify FolioPress Workflow — Resumable Implementation Plan

> **Status:** IN PROGRESS — Tasks 1–2 complete. Resume at Task 3.
> **For agentic workers:** Use `superpowers:executing-plans` (inline) to implement the remaining tasks. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution state (do not redo completed work):**
> - Worktree: `C:\app\RFEdigital\.agents\worktrees\simplify-foliopress-workflow` (branch `simplify-foliopress-workflow`)
> - Base commit: `e3c1c61` · Current HEAD: `8791b79` (clean working tree; `npm run lint` and `npm run build` pass)
> - Ledger: `.superpowers/sdd/2026-11-25-simplify-foliopress-workflow/progress.md` — trust it over memory after context compaction.
> - Environment: `npm install` must use `--legacy-peer-deps` (pre-existing esbuild↔Vite 8 peer conflict). `package-lock.json` was committed in Task 1. `lint` = `tsc --noEmit`, `build` = `vite build`. No `npm test` script exists; run unit suites via `npx tsx --test <file>`.
> - Subagent/teammate dispatch proved unreliable in the originating session (two attempts produced no output); **execute inline**. A failed subagent left an untracked `scripts/generate-studio.mjs` which was deleted.
>
> **Rulings carried from earlier work:**
> - Secondary nav item for Plans/Jobs is labeled **"Background Runs"** (not "Plans & Jobs") to match Task 8's merge.
> - In Task 1, `generation` and `export` URLs redirect to `studio`; their capabilities are re-surfaced by Tasks 3/6/7.

---

**Goal:** Make the shortest path from a book/product idea to a finished PDF obvious and low-friction, while keeping **all existing features** (Trends, Plans/Jobs, Gallery, Storage, Prompt Studio, Export, Google integrations) available through clear secondary entry points rather than competing primary buttons.

**Architecture:** A single primary workflow — **Dashboard → Studio → Download PDF**. Supporting features move to secondary navigation or contextual panels. Core stack unchanged: Vite 8, React 19, TypeScript, Tailwind 4, Express, `pdf-lib`.

## Global Constraints (still binding)

- Preserve every existing feature and API endpoint unless explicitly replaced by a clearer equivalent.
- Preserve existing generation prompts, PDF assembly, typography, bleed/safe-margin math, and export file quality.
- Maintain backward compatibility for `workspace.json` data already saved by users.
- Keep PWA installability and service-worker behavior.
- Do not add new dependencies unless strictly required for consolidation.
- All changes must pass `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Review Focus (still binding)

1. **Loss of print quality** — UI simplification must not change KDP PDF dimensions, image handling, or text wrapping.
2. **Broken existing workspaces** — existing `products`, `assets`, `generations`, `plans`, `jobs`, and `trendScans` must load.
3. **Buried features** — features kept in the codebase must remain discoverable.
4. **Regressed one-shot generation** — the primary **Generate Book** action must still produce cover + interior pages + final PDF.
5. **Duplicate CTAs left behind** — one obvious primary action per screen.

---

## Completed Tasks

### Phase 1: Navigation & Information Architecture

#### Task 1: Reorganize top-level navigation around one primary workflow ✅ DONE
- Commit: `ea1b15b`
- Primary nav: Dashboard, Studio, Assets. Secondary ("More"): Market Trends, Background Runs, Settings.
- `identity` → `settings` rename; `/identity` redirects to `/settings`. Legacy redirects: `library→dashboard`, `builder→studio`, `gallery/storage→assets`, `generation→studio`, `planning/jobs→background-runs`, `export→studio`.
- Export, Prompt Studio, Gallery, Storage removed from top-level nav. Mobile tab bar = Dashboard/Studio/Assets + More.
- Verified: lint + build pass; unit suite `npx tsx --test src/lib/workspaceLogic.test.ts` 24/24.

#### Task 2: Merge Gallery and Storage into a single Assets view ✅ DONE
- Commit: `8791b79`
- New `src/components/AssetsView.tsx` combines global gallery images + product-scoped storage assets; All-products/product filter; upload toggle (product asset vs global reference).
- `ImageGalleryView.tsx` and `StorageView.tsx` kept but no longer routed; delete only after AssetsView is verified.
- Verified: lint + build pass.

---

## Remaining Tasks (in dependency order)

### Phase 2: Studio Workflow Simplification

#### Task 3: Refactor the monolithic ProductBuilderView into a 3-tab Studio
**Description:** `src/components/ProductBuilderView.tsx` is ~3,000 lines with a 4-step flow. Split it into focused sub-components and reduce to **3 tabs**: **Concept**, **Generate**, **Download**. Inline editing of prompts and story copy lives inside the Generate tab.

**Acceptance criteria:**
- [ ] `BuilderStep` becomes `1 | 2 | 3` (move the type to `types/workspace.ts`; update `App.tsx` import).
- [ ] Tab labels: **1. Concept**, **2. Generate**, **3. Download**.
- [ ] Split into at least `StudioConceptPanel.tsx`, `StudioGeneratePanel.tsx`, `StudioDownloadPanel.tsx`, and a thin `StudioView.tsx`.
- [ ] Generate tab shows editable prompt pack, generated story/manuscript preview, generated asset thumbnails, and one primary **"Generate Book"** action (action itself lands in Task 4).
- [ ] Download tab shows the latest export artifact and **Download PDF** / **Download PNG Bundle** buttons.
- [ ] No functionality from old Step 3 "Pages & Copy" is lost — story text editing and page ordering move into the Generate tab (full inline editing is Task 5).

**Execution notes (from the failed first attempt):**
- Do the split mechanically: keep all state/handlers in `StudioView.tsx` and move the step JSX into the panel files as props-driven components. Do **not** rewrite the logic.
- Old step mapping: step 1 → Concept; steps 2+3 (prompts + pages/copy) → Generate; step 4 (export) → Download.
- `App.tsx` imports `BuilderStep` from `types/workspace.ts` and `StudioView` from `./components/StudioView`.
- Keep `ProductBuilderView.tsx` untouched until `StudioView` is verified, then delete it.
- **Highest-risk task; commit in small slices (type/step-meta change → JSX condition changes → panel extraction → App.tsx switch), running lint/build after each slice.**

**Verification:**
- [ ] `tsc --noEmit` passes after every slice.
- [ ] Create a new product and walk all three tabs; existing products open at the right tab by readiness.

**Dependencies:** Task 1 ✅ · **Estimated scope:** Large (5–8 files, mostly moving code)

#### Task 4: Make "Generate Book" the one primary action
**Acceptance criteria:**
- [ ] New `POST /api/generate/product` endpoint accepting `productId` + optional `provider`: (1) generate manuscript, (2) sync interior prompts to manuscript, (3) generate cover, (4) generate each interior illustration, (5) assemble/save KDP PDF, (6) return final `artifact` + updated product.
- [ ] Generate tab progress indicator: "Writing story…", "Generating cover…", "Generating page N…", "Assembling PDF…".
- [ ] Individual prompt "Generate" buttons remain but visually secondary.
- [ ] On failure, partial results saved + clear **Retry** button.

**Dependencies:** Task 3 · **Scope:** Medium (3–5 files)

#### Task 5: Inline story text and page editing inside the Generate tab
**Acceptance criteria:**
- [ ] Each interior prompt card in Generate shows a thumbnail and editable **Story Text** field.
- [ ] Story text edits save to the asset (`storyText`) and re-export without regenerating art.
- [ ] Up/down arrows reorder pages (updates `pageOrder`, re-exports in new order).
- [ ] Old standalone "Pages & Copy" step removed (moves into Generate).

**Dependencies:** Task 3 · **Scope:** Medium (2–4 files)

#### Task 6: Pre-select export options and simplify the Download tab
**Acceptance criteria:**
- [ ] Category defaults: children's book (bleed on, title page on, captions on, cover title on, layout `below-image`); coloring book (bleed on, title off, captions off, layout `none`); art print (bleed off, title off, layout `none`).
- [ ] Advanced options behind **"Advanced export options"** expander.
- [ ] Latest artifact shown with file size, page count, primary **Download PDF** button.
- [ ] **Back up to Google Drive** as secondary action when signed in.

**Dependencies:** Task 3 · **Scope:** Small–Medium (2–3 files)

### Phase 3: Keep Advanced Features Discoverable but Secondary

#### Task 7: Move Prompt Studio capabilities into an Advanced panel
**Acceptance criteria:**
- [ ] Remove `GenerationView.tsx` from main nav and `App.tsx` module switcher (already out of nav from Task 1; confirm no orphaned references).
- [ ] "Advanced" expander in Studio → Generate: provider/model picker, one-off text generation for KDP metadata, one-off illustration generation with custom prompt.
- [ ] Prompt-prefill flow from Library/Trends opens Studio → Generate with prompts pre-filled.
- [ ] No orphaned `workspaceApi.generateText` / `generateIllustration` calls in `App.tsx`.

**Dependencies:** Tasks 3–4 · **Scope:** Small–Medium (2–4 files)

#### Task 8: Simplify Plans & Jobs into a single background-runs screen
**Acceptance criteria:**
- [ ] Replace separate `PlanningView` and `JobsView` with one **"Background Runs"** secondary item (nav label already in place from Task 1).
- [ ] Combined view lists plans and their queued/running/completed jobs.
- [ ] Primary action **"Run Next"**; pause/resume/retry/cancel secondary; auto-poll toggle in view header.

**Dependencies:** Task 1 ✅ · **Scope:** Medium (3–5 files)

#### Task 9: Move Trends and Settings into clear secondary locations
**Acceptance criteria:**
- [ ] Trends stays secondary ("Market Trends"); Settings (formerly Identity) secondary or user-menu.
- [ ] Settings sections: Profile/Imprint, AI Keys (read-only status), Google Account, Apps Script Bridge (advanced).
- [ ] Token management + bridge setup collapsed under an "Advanced" section.

**Dependencies:** Task 1 ✅ · **Scope:** Small–Medium (2–4 files)

### Phase 4: Backend Cleanup

#### Task 10: Split `server/app.ts` into route modules
**Acceptance criteria:**
- [ ] Create `server/routes/library.ts`, `assets.ts`, `generate.ts`, `export.ts`, `settings.ts`; move handlers; `app.ts` only wires middleware + routers. No behavior changes.

**Dependencies:** Phases 2–3 · **Scope:** Medium (6–8 files)

#### Task 11: Centralize prompt templates and reduce `workspaceLogic.ts` bloat
**Acceptance criteria:**
- [ ] Extract category prompt templates to `src/lib/promptTemplates.ts`; `buildPromptPackFromConcept`/`buildPromptPackFromTrend` become thin selectors.
- [ ] Existing tests pass unchanged (`npx tsx --test src/lib/workspaceLogic.test.ts`); no prompt wording changes unless required to keep tests passing.

**Dependencies:** None (can run in parallel with Phase 1–2) · **Scope:** Medium (2–4 files)

#### Task 12: Auto-select AI provider and model
**Acceptance criteria:**
- [ ] `resolveDefaultProvider()`: `openrouter` if `OPENROUTER_API_KEY` set, else `gemini` if `GEMINI_API_KEY` set, else clear setup message.
- [ ] All generation endpoints use the default unless `provider` is explicit.
- [ ] Model picker hidden by default (Advanced expander only). Defaults unchanged: image `google/gemini-2.5-flash-image`, text `openai/gpt-4o-mini`.

**Dependencies:** Task 7 · **Scope:** Small (2–3 files)

### Phase 5: Verification & Rollout

#### Task 13: Add an end-to-end smoke test for the simplified happy path
**Acceptance criteria:**
- [ ] Test creates a product via `POST /api/library/products`, calls `POST /api/generate/product`, asserts artifact `format: 'pdf'` and `pageCount >= 1`.
- [ ] Mock/stub AI calls (no live keys). Runs via `npx tsx --test`.

**Dependencies:** Tasks 4, 10 · **Scope:** Small (1–2 files)

#### Task 14: Final lint, build, and manual QA
**Acceptance criteria:**
- [ ] `npm run lint` zero errors; `npm run build` produces valid `dist/`.
- [ ] Manual QA: create children's book, run **Generate Book**, download PDF, confirm cover + interior pages + story text crisp.
- [ ] Manual QA: Trends, Background Runs, Assets, Settings reachable from secondary menu.

**Dependencies:** All preceding · **Scope:** Small (verification only)

---

## Checkpoints

- **After Phase 2:** Studio has 3 tabs + working **Generate Book**; Prompt Studio no longer top-level; end-to-end create → generate → PDF works.
- **After Phase 3:** Background Runs merged; Trends/Settings secondary; Drive upload works from Download tab.
- **After Phase 4:** Backend in route modules; prompt templates centralized; provider auto-selected.
- **Complete:** All tests pass, build succeeds, manual QA confirms quality + discoverability.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Refactoring the 3,000-line builder introduces regressions | High | Move code in small commits, keep handler signatures, lint/build after each slice; keep `ProductBuilderView.tsx` until `StudioView` verified |
| Advanced users cannot find Trends/Plans/Settings | Low | Persistent secondary menu |
| `workspace.json` with old data fails to load | Medium | Keep arrays in persisted schema; only change API snapshot shape if necessary |
| One-click pipeline times out on slow AI calls | Medium | Reuse existing 60-second timeout on `/api/generate/illustration`; run generations sequentially with progress updates |
| Existing URL bookmarks break | Low | Redirects already added in Task 1 |

## Open Questions

1. **Navigation grouping** — Dashboard / Studio / Assets primary + Trends / Background Runs / Settings in "More" (shipped in Task 1). Confirm?
2. **Download tab defaults** — are the category-based export defaults correct for typical books/products?
3. **Existing roadmap** — `tasks/plan.md` (cover wrap, puzzles, wall art, etc.) is unrelated to this UX simplification. Keep as a separate long-term track?
