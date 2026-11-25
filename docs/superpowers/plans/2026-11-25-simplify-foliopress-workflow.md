# Simplify FolioPress Workflow — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` (native) or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shortest path from a book/product idea to a finished PDF obvious and low-friction, while keeping **all existing features** (Trends, Plans/Jobs, Gallery, Storage, Prompt Studio, Export, Google integrations) available through clear secondary entry points rather than competing primary buttons.

**Architecture:** Establish a single primary workflow — **Dashboard → Studio → Download PDF**. Reorganize navigation so Studio is the obvious center. Move supporting features (Assets, Trends, Plans/Jobs, Settings) into secondary navigation or contextual panels so they do not interrupt the happy path. Keep the core stack unchanged: Vite 8, React 19, TypeScript, Tailwind 4, Express, `pdf-lib`.

**Spec:** This document is the spec. It argues from the current codebase inspection in `C:\app\RFEdigital`.

## Target Happy Path

A first-time user should be able to:

1. Open the app and see a **Dashboard** with their products and a single prominent **“New Book / Product”** button.
2. Land in the **Studio** on the **Concept** tab, enter a title/audience/style, and optionally upload a reference photo.
3. Move to the **Generate** tab, where AI has already pre-filled cover, story, and interior prompts.
4. Press one primary **“Generate Book”** button that runs story → illustrations → PDF assembly with a progress indicator.
5. Land on the **Download** tab and click **“Download PDF”**.

Advanced features (market trends, batch plans, job queue, image gallery, per-product storage, standalone export, settings) remain reachable but never sit between the user and the Download button.

## Global Constraints

- Preserve every existing feature and API endpoint unless explicitly replaced by a clearer equivalent.
- Preserve existing generation prompts, PDF assembly, typography, bleed/safe-margin math, and export file quality.
- Maintain backward compatibility for `workspace.json` data already saved by users; do not corrupt existing products/assets/plans/jobs/trend-scans.
- Keep PWA installability and service-worker behavior.
- Do not add new dependencies unless strictly required for consolidation.
- All changes must pass `npm run lint` (`tsc --noEmit`) and `npm run build` before they are considered done.

## Review Focus

1. **Loss of print quality** — simplifying UI defaults must not change the generated KDP PDF dimensions, image handling, or text wrapping.
2. **Broken existing workspaces** — existing `products`, `assets`, `generations`, `plans`, `jobs`, and `trendScans` must load.
3. **Buried features** — features kept in the codebase must remain discoverable; hiding them behind menus is fine, but they must not disappear entirely.
4. **Regressed one-shot generation** — the new primary **Generate Book** action must still produce cover + interior pages + final PDF.
5. **Duplicate CTAs left behind** — after consolidation, there should be one obvious primary action per screen, not multiple competing buttons.

---

## Task List

### Phase 1: Navigation & Information Architecture

#### Task 1: Reorganize top-level navigation around one primary workflow

**Description:** Reduce cognitive load by making the primary nav show only the happy-path modules, and move supporting tools to a secondary "More" or "Tools" section.

**Acceptance criteria:**
- [ ] Primary nav items: **Dashboard**, **Studio**, **Assets**.
- [ ] Secondary nav (sidebar footer or mobile "More" menu): **Trends**, **Plans & Jobs**, **Settings**.
- [ ] Rename `identity` route/module to `settings` for clarity; keep `/identity` redirecting to `/settings`.
- [ ] Remove the standalone **Export** nav item; export is reached from Studio Download tab and from Dashboard product cards.
- [ ] Remove **Prompt Studio**, **Gallery**, and **Storage** from top-level nav (they become part of Studio/Assets).
- [ ] Mobile bottom tab bar shows Dashboard, Studio, Assets, plus a "More" overflow for Trends/Plans/Settings.

**Verification:**
- [ ] `npm run lint` passes.
- [ ] Start the dev server and confirm only Dashboard, Studio, Assets are in the main nav.
- [ ] Confirm Trends, Plans & Jobs, Settings are reachable from the secondary menu.

**Dependencies:** None  
**Estimated scope:** Small–Medium (2–4 files: `App.tsx`, `types/workspace.ts`, nav constants)

---

#### Task 2: Merge Gallery and Storage into a single Assets view

**Description:** The Image Gallery and Product Storage folders both manage images. Unify them into one **Assets** screen where users can browse globally or filter by product, and attach any image to the active product.

**Acceptance criteria:**
- [ ] Create `src/components/AssetsView.tsx` that combines list behavior from `ImageGalleryView` and `StorageView`.
- [ ] Default filter is "All assets"; user can narrow to a product.
- [ ] Uploading an asset asks whether it is a **global reference** or belongs to the **selected product**.
- [ ] Keep `ImageGalleryView.tsx` and `StorageView.tsx` components for now, but route only to `AssetsView`; delete the old components only after AssetsView is verified.
- [ ] The auto-backup of reference photos to the gallery is simplified: a product reference photo can optionally be saved globally.

**Verification:**
- [ ] Upload a global reference image and confirm it appears for all products.
- [ ] Upload a product asset and confirm it is scoped to that product.
- [ ] Existing gallery images load under "All assets".

**Dependencies:** Task 1  
**Estimated scope:** Medium (3–5 files)

---

### Phase 2: Studio Workflow Simplification

#### Task 3: Refactor the monolithic ProductBuilderView into a 3-tab Studio

**Description:** `ProductBuilderView.tsx` is ~3,000 lines and uses a 4-step flow. Split it into focused sub-components and reduce to **3 tabs**: **Concept**, **Generate**, **Download**. Inline editing of prompts and story copy happens inside the Generate tab.

**Acceptance criteria:**
- [ ] `BuilderStep` becomes `1 | 2 | 3`.
- [ ] Tab labels: **1. Concept**, **2. Generate**, **3. Download**.
- [ ] `ProductBuilderView.tsx` is split into at least `StudioConceptPanel.tsx`, `StudioGeneratePanel.tsx`, `StudioDownloadPanel.tsx`, and a thin `StudioView.tsx`.
- [ ] Generate tab shows editable prompt pack, generated story/manuscript preview, generated asset thumbnails, and one primary **"Generate Book"** action.
- [ ] Download tab shows the latest export artifact and **Download PDF** / **Download PNG Bundle** buttons.
- [ ] No functionality from old Step 3 "Pages & Copy" is lost — story text editing and page ordering move into the Generate tab.

**Verification:**
- [ ] Create a new product and walk through all three tabs without errors.
- [ ] Confirm existing products open in the new Studio at the appropriate tab based on readiness.
- [ ] `tsc --noEmit` passes.

**Dependencies:** Task 1  
**Estimated scope:** Large (5–8 files, mostly moving existing code)

---

#### Task 4: Make "Generate Book" the one primary action

**Description:** The Generate tab currently has many individual "Generate" buttons (cover, story, listing, each interior page). Keep those as secondary/inline actions, but add a single prominent **"Generate Book"** button that runs the full pipeline.

**Acceptance criteria:**
- [ ] Add a new `POST /api/generate/product` endpoint that accepts `productId` and optional `provider`. It performs: (1) generate manuscript from `manuscriptPrompt`, (2) sync interior prompts to the manuscript, (3) generate cover, (4) generate each interior illustration, (5) assemble and save KDP PDF, (6) return final `artifact` and updated product.
- [ ] The Generate tab shows a clear progress indicator: "Writing story…", "Generating cover…", "Generating page N…", "Assembling PDF…".
- [ ] Individual prompt "Generate" buttons remain available but are visually secondary.
- [ ] On failure, partial results are saved and a clear **Retry** button appears.

**Verification:**
- [ ] Click **Generate Book** on a new children's book; confirm the final PDF is downloadable and contains cover + interior pages.
- [ ] Confirm the existing per-prompt generate buttons still work.

**Dependencies:** Task 3  
**Estimated scope:** Medium (3–5 files)

---

#### Task 5: Inline story text and page editing inside the Generate tab

**Description:** Users currently bounce between Step 2 (prompts) and Step 3 (pages/copy) to edit story text. Move per-page story text and page ordering into the Generate tab so the loop is tighter.

**Acceptance criteria:**
- [ ] Each interior prompt card in the Generate tab shows a thumbnail (if generated) and an editable **Story Text** field.
- [ ] Changes to story text are saved to the asset (`storyText`) and can be re-exported without regenerating the illustration.
- [ ] Drag handles or up/down arrows reorder pages; reordering updates `pageOrder` and re-exports in the new order.
- [ ] The old standalone "Pages & Copy" step is removed; its capabilities live here.

**Verification:**
- [ ] Edit story text on a generated page and re-export the PDF; confirm the new text appears.
- [ ] Reorder two pages and confirm the PDF reflects the new order.

**Dependencies:** Task 3  
**Estimated scope:** Medium (2–4 files)

---

#### Task 6: Pre-select export options and simplify the Download tab

**Description:** The current Export step shows many checkboxes (bleed, title page, captions, cover title, page layout). Most of these can be defaulted based on the product category, leaving the user with just **Download PDF** and **Download PNG Bundle**.

**Acceptance criteria:**
- [ ] Download tab pre-selects sensible defaults based on category:
  - Children’s book: bleed on, title page on, captions on, cover title on, layout `below-image`.
  - Coloring book: bleed on, title page off, captions off, layout `none`.
  - Art print: bleed off, title page off, layout `none`.
- [ ] Advanced export options are hidden behind an **"Advanced export options"** expander.
- [ ] The latest artifact is shown with file size, page count, and a primary **Download PDF** button.
- [ ] **Back up to Google Drive** appears as a secondary action on the Download tab if the user is signed in.

**Verification:**
- [ ] Export a children’s book with default options; confirm title page and captions are included.
- [ ] Export a coloring book; confirm captions are off by default.

**Dependencies:** Task 3  
**Estimated scope:** Small–Medium (2–3 files)

---

### Phase 3: Keep Advanced Features Discoverable but Secondary

#### Task 7: Move Prompt Studio capabilities into an Advanced panel

**Description:** The standalone Prompt Studio duplicates generation already available in the Studio. Remove it from top-level nav and surface its capabilities only as an **"Advanced"** panel inside Studio → Generate.

**Acceptance criteria:**
- [ ] Remove `GenerationView.tsx` from the main nav and from `App.tsx`’s module switcher.
- [ ] Add an **"Advanced"** expander in Studio → Generate that contains:
  - Provider/model picker (default auto-selected).
  - One-off text generation for KDP metadata.
  - One-off illustration generation with custom prompt.
- [ ] The prompt-prefill flow from Library/Trends opens Studio → Generate with prompts pre-filled.
- [ ] No orphaned `workspaceApi.generateText` / `generateIllustration` calls remain in `App.tsx`.

**Verification:**
- [ ] Search the codebase for `GenerationView` and `Prompt Studio` nav references; confirm they are gone.
- [ ] Trigger "Generate illustration" from Library and confirm it opens Studio → Generate.

**Dependencies:** Tasks 3–4  
**Estimated scope:** Small–Medium (2–4 files)

---

#### Task 8: Simplify Plans & Jobs into a single background-runs screen

**Description:** Batch Plans and the Job Queue are currently two separate views that expose the same underlying mechanism. Merge them into one **Background Runs** screen reachable from the secondary nav, showing queued/completed runs with simple controls.

**Acceptance criteria:**
- [ ] Replace separate `PlanningView` and `JobsView` nav items with a single **"Background Runs"** secondary item.
- [ ] Create a combined view that lists plans and their queued/running/completed jobs.
- [ ] Primary action on the screen is **"Run Next"**; pause/resume/retry/cancel are secondary.
- [ ] The auto-poll toggle remains but is tucked into the view header, not a top-level module.

**Verification:**
- [ ] Queue a plan and confirm it appears in Background Runs with status updates.
- [ ] Confirm the old `Planning` and `Jobs` nav items are gone.

**Dependencies:** Task 1  
**Estimated scope:** Medium (3–5 files)

---

#### Task 9: Move Trends and Settings into clear secondary locations

**Description:** Trends and Settings are useful but not part of the daily create-to-PDF flow. Keep them reachable without competing for primary attention.

**Acceptance criteria:**
- [ ] **Trends** remains a secondary nav item labeled "Market Trends".
- [ ] **Settings** (formerly Identity) becomes a secondary nav item or user-menu item.
- [ ] The Settings screen is reorganized into sections: Profile/Imprint, AI Keys (read-only status), Google Account, Apps Script Bridge (advanced).
- [ ] API token management and Apps Script bridge setup remain in Settings but are collapsed under an **"Advanced"** section.

**Verification:**
- [ ] Confirm Trends and Settings are reachable from the secondary menu.
- [ ] Confirm Settings sections are clearly labeled and not overwhelming.

**Dependencies:** Task 1  
**Estimated scope:** Small–Medium (2–4 files)

---

### Phase 4: Backend Cleanup

#### Task 10: Split `server/app.ts` into route modules

**Description:** `server/app.ts` is ~2,600 lines. Organize the remaining endpoints into route files so the simplified system is maintainable.

**Acceptance criteria:**
- [ ] Create `server/routes/library.ts`, `server/routes/assets.ts`, `server/routes/generate.ts`, `server/routes/export.ts`, `server/routes/settings.ts`.
- [ ] Move relevant handlers from `app.ts` into these modules.
- [ ] `server/app.ts` only wires middleware and routers.
- [ ] No behavior changes; existing tests pass.

**Verification:**
- [ ] `tsc --noEmit` passes.
- [ ] Run the smoke test from Task 13 end-to-end.

**Dependencies:** Phase 2–3  
**Estimated scope:** Medium (6–8 files, mostly moving code)

---

#### Task 11: Centralize prompt templates and reduce `workspaceLogic.ts` bloat

**Description:** `workspaceLogic.ts` is ~1,600 lines with heavy category-specific prompt builders. Keep the quality but centralize templates so the file is easier to maintain.

**Acceptance criteria:**
- [ ] Extract category-specific prompt templates into `src/lib/promptTemplates.ts`.
- [ ] `buildPromptPackFromConcept` and `buildPromptPackFromTrend` become thin functions that select a template and interpolate variables.
- [ ] Existing tests for `buildPromptPackFromConcept` / `buildPromptPackFromTrend` still pass without modification.
- [ ] No prompt wording changes unless required to keep tests passing.

**Verification:**
- [ ] `npm test` (or `node --test src/lib/workspaceLogic.test.ts`) passes.
- [ ] `tsc --noEmit` passes.

**Dependencies:** None (can be done in parallel with Phase 1–2)  
**Estimated scope:** Medium (2–4 files)

---

#### Task 12: Auto-select AI provider and model

**Description:** Users currently must choose between Gemini and OpenRouter and pick models. Default to the best available configured provider and keep overrides in Advanced.

**Acceptance criteria:**
- [ ] New helper `resolveDefaultProvider()` returns `openrouter` if `OPENROUTER_API_KEY` is set, otherwise `gemini` if `GEMINI_API_KEY` is set, otherwise shows a clear setup message.
- [ ] All generation endpoints use this default unless `provider` is explicitly supplied.
- [ ] The model picker is hidden by default; shown only when the Advanced expander is opened.
- [ ] Default image model for OpenRouter remains `google/gemini-2.5-flash-image`; default text model remains `openai/gpt-4o-mini`.

**Verification:**
- [ ] Generate an illustration with only `OPENROUTER_API_KEY` set; confirm it uses OpenRouter without manual selection.
- [ ] Generate text with only `GEMINI_API_KEY` set; confirm it uses Gemini.

**Dependencies:** Task 7  
**Estimated scope:** Small (2–3 files)

---

### Phase 5: Verification & Rollout

#### Task 13: Add an end-to-end smoke test for the simplified happy path

**Description:** Ensure the new shortest path (create product → generate → export PDF) is covered by an automated test.

**Acceptance criteria:**
- [ ] Add a test that creates a product via `POST /api/library/products`, calls `POST /api/generate/product`, and asserts the returned artifact has `format: 'pdf'` and `pageCount >= 1`.
- [ ] Mock or stub AI calls so the test does not require live API keys.
- [ ] Test runs with `npm test`.

**Verification:**
- [ ] `npm test` passes.

**Dependencies:** Tasks 4, 10  
**Estimated scope:** Small (1–2 files)

---

#### Task 14: Final lint, build, and manual QA

**Description:** Verify the simplified application still compiles, builds, and produces the same quality output.

**Acceptance criteria:**
- [ ] `npm run lint` passes with zero errors.
- [ ] `npm run build` produces a valid `dist/` folder.
- [ ] Manual QA: create a children's book product, run **Generate Book**, download PDF, and visually confirm cover + interior pages + story text are present and crisp.
- [ ] Manual QA: confirm Trends, Background Runs, Assets, and Settings are still reachable from the secondary menu.

**Verification:**
- [ ] Paste build/lint output and QA notes into the task.

**Dependencies:** All preceding tasks  
**Estimated scope:** Small (verification only)

---

## Checkpoints

### Checkpoint: After Phase 1
- [ ] Navigation shows Dashboard, Studio, Assets as primary; Trends/Background Runs/Settings in secondary menu.
- [ ] `tsc --noEmit` passes.

### Checkpoint: After Phase 2
- [ ] Studio has 3 tabs and a working **Generate Book** action.
- [ ] Prompt Studio is no longer a top-level module.
- [ ] End-to-end create → generate → PDF works.

### Checkpoint: After Phase 3
- [ ] Plans/Jobs merged into Background Runs.
- [ ] Trends and Settings remain reachable but not in primary nav.
- [ ] Drive upload still works from Download tab.

### Checkpoint: After Phase 4
- [ ] Backend is organized into route modules.
- [ ] Prompt templates are centralized.
- [ ] Provider/model selection defaults automatically.

### Checkpoint: Complete
- [ ] All tests pass.
- [ ] Build succeeds.
- [ ] Manual QA confirms output quality is preserved and all features are still discoverable.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Refactoring the 3,000-line builder introduces regressions | High | Move code in small commits, keep existing handler signatures, run the smoke test after each task. |
| Advanced users cannot find Trends/Plans/Settings | Low | Keep them in a persistent secondary menu, not hidden behind obscure gestures. |
| `workspace.json` with old `trendScans`, `plans`, or `jobs` fails to load | Medium | Keep those arrays in the persisted schema; only change the API snapshot shape if necessary. |
| One-click pipeline times out on slow AI calls | Medium | Reuse the existing 60-second timeout on `/api/generate/illustration` and run generations sequentially with progress updates. |
| Existing URL bookmarks break | Low | Add redirects from `/builder`, `/identity`, `/generation`, `/planning`, `/jobs`, `/gallery`, `/storage`, `/export` to the new routes. |

---

## Open Questions / Decisions for Review

1. **Navigation grouping** — Does Dashboard / Studio / Assets as primary + Trends / Background Runs / Settings in "More" feel right?
2. **Download tab defaults** — Are the category-based export defaults above correct for your typical books/products?
3. **Existing roadmap** — The old `tasks/plan.md` feature roadmap (cover wrap, puzzles, wall art, etc.) is unrelated to this UX simplification. Should it stay as a separate long-term track, or be paused while we finish this first?
