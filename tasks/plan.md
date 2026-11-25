# Implementation Plan: FolioPress Next Milestones

> **For agentic workers:** Use `superpowers:executing-plans` (native) or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Build on the existing **FolioPress** Vite React + Express workspace to close the remaining gaps from the original Digital Product Studio plan. The next phase turns the working prototype into a production-ready children's book / printable art factory: real image generation, print-ready export, reference vault, cost tracking, and multi-product templates.

## Current State Snapshot

The app is already a running local workspace in `C:\Users\russe\RFEdigital`:

- **Stack:** Vite 8 + React 19 + TypeScript + Tailwind CSS 4, Express 4 server, local JSON persistence in `.data/workspace.json`.
- **Auth & Cloud:** Firebase Google OAuth with in-memory access token; direct Google Sheets/Drive API calls from the server.
- **Modules:** Library, Storage, Generation, Planning, Jobs, Export, Identity.
- **AI:** Gemini (`gemini-4-hydrogen`) and optional OpenRouter for text; illustrations are generated as **SVG** only.
- **Export:** KDP interior PDF builder (`pdf-lib`) + asset ZIP bundle (`JSZip`).
- **Jobs:** Simple FIFO queue served by `POST /api/jobs/run-next` with pause/resume/retry/cancel.

## How the Current App Compares to the Original Plan

| Original Plan Target | Current State | Gap Severity |
|---|---|---|
| Next.js + Vercel shell | Vite + Express local server | **Architecture pivot** — keep the working local stack and defer Vercel migration |
| Google Apps Script + Sheets backend | Direct Sheets/Drive calls + local JSON | **Medium** — no Apps Script bridge or time-driven trigger yet |
| IndexedDB local draft cache | Not implemented | **Low** — local server already stores assets on disk |
| OpenRouter image endpoint for illustrations | Illustrations generated as SVG via text models | **High** — need real raster image generation |
| Vision reference analysis / Character Bible | No vision analysis or asset tagging | **High** — reference vault is missing |
| Pages table with layout presets | Only `assets` with `pageOrder` | **Medium** — need page roles and layout presets |
| Cost_Log per AI call | No cost logging | **Medium** — needed for spend guardrails |
| KDP cover wrap calculator | Only interior PDF | **High** — KDP paperback cover export missing |
| DPI preflight / upscaler hook | No preflight | **Medium** — needed for print quality |
| Seller Pack (keywords, blurb, BISAC, Etsy tags) | Basic KDP metadata generation exists, no bundle | **Medium** — extend metadata into seller pack ZIP |
| Puzzle generators (maze, word search, cryptogram) | Not implemented | **Low** — only for coloring/activity books |
| Wall art multi-ratio / flashcards | Not implemented | **Low** — new product blueprints |
| Apps Script BatchTrigger cron | Not implemented | **Medium** — background queue only runs when client is open |

## Architecture Decisions

1. **Stay local-first.** The current Vite + Express + JSON store works. Defer a Next.js/Vercel rewrite until after the studio features are proven.
2. **Extend `assets` before adding a full `Pages` table.** The asset-centric model already carries `pageOrder`. Add `role`, `layoutPreset`, and `pageText` fields to assets before introducing a separate `pages` collection.
3. **Log cost at the AI service boundary.** Wrap every Gemini/OpenRouter call to write to a new `costLog` array.
4. **Use OpenRouter for raster illustrations and Gemini for vision/text.** Keeps provider flexibility while getting real PNG artwork.

## Task List

### Phase 1: Foundation — Pages, Assets & Cost Tracking

#### Task 1: Add page-level metadata to assets
**Description:** Give assets the concept of a page role and layout so the PDF builder can render spreads correctly.

**Acceptance criteria:**
- [ ] `StorageAsset` type has `role: 'cover' | 'title' | 'story' | 'back'` and `layoutPreset: 'full-bleed-text' | 'top-art-bottom-text' | 'split-spread' | 'framed'`.
- [ ] `StorageAsset` has an optional `pageText` field (≤2,000 chars) for inline page copy.
- [ ] `POST /api/storage/upload` accepts and persists `role`, `layoutPreset`, and `pageText`.
- [ ] `PATCH /api/storage/assets/:id` endpoint allows editing role, layoutPreset, pageOrder, and pageText.
- [ ] Storage view shows editable page role and layout per asset.
- [ ] `calculateKdpDimensionsPt` and `buildKdpPdfBuffer` still pass existing tests after type changes.

**Verification:**
- [ ] `npm run lint` (or `tsc --noEmit`) passes.
- [ ] Upload an asset with role `cover` and layout `framed`; reload workspace and confirm fields persist.

**Dependencies:** None
**Estimated scope:** Medium (3–5 files)

---

#### Task 2: Add AI cost logging
**Description:** Track every paid/tracked AI call in a new `Cost_Log` collection so users can reconcile with OpenRouter/Gemini dashboards.

**Acceptance criteria:**
- [ ] New type `CostRecord` with `id`, `productId`, `model`, `callType`, `promptTokens?`, `completionTokens?`, `usdCost`, `createdAt`.
- [ ] `WorkspaceSnapshot` exposes `costLog: CostRecord[]`.
- [ ] `generatePublishingText` and `generateStorybookIllustration` (and OpenRouter wrapper) return usage/cost metadata.
- [ ] Server writes a `CostRecord` after every successful AI call.
- [ ] Identity/Settings view shows a running total per product and per model.
- [ ] Cost records are persisted in `.data/workspace.json` and loaded on startup.

**Verification:**
- [ ] Generate text and illustration; confirm two cost rows appear in `/api/workspace`.
- [ ] Total spend in UI matches sum of `usdCost` values.

**Dependencies:** None
**Estimated scope:** Small–Medium (2–4 files)

---

### Phase 2: AI Quality — Raster Images & Vision

#### Task 3: Implement raster illustration generation
**Description:** Replace SVG-only illustration output with real PNG images from an image model, while keeping SVG as a fallback option.

**Acceptance criteria:**
- [ ] New server function `generateRasterIllustration` calls OpenRouter image endpoint (`POST /api/v1/images`) or Gemini Imagen if configured.
- [ ] `POST /api/generate/illustration` accepts `format: 'svg' | 'png'` and stores a PNG asset when PNG is chosen.
- [ ] PNG assets are saved to `.data/uploads/` and served by `/api/storage/files/:filename`.
- [ ] Generation view lets the user choose SVG or PNG before generating.
- [ ] `buildKdpPdfBuffer` embeds PNG/JPEG assets directly and rasterizes SVG fallback at 300 DPI.

**Verification:**
- [ ] Generate a PNG illustration; verify file is saved and appears in Storage.
- [ ] Export a PDF containing the PNG; open it and confirm image is crisp.

**Dependencies:** Task 1 (asset metadata), Task 2 (cost logging)
**Estimated scope:** Medium (3–5 files)

---

#### Task 4: Build a Reference Vault with AI vision summaries
**Description:** Let users upload reference images (characters, style plates, props) and get AI-generated vision summaries that feed into prompts.

**Acceptance criteria:**
- [ ] New asset tag `kind: 'reference'` and `tag` enum (`character`, `style`, `prop`).
- [ ] `POST /api/generate/vision` accepts an asset ID, reads the image bytes, and sends it to a vision model (Gemini or OpenRouter) with prompt "Describe the character/style in this image for an illustrator."
- [ ] Vision summary is stored back on the asset as `visionSummary`.
- [ ] Reference vault panel in Storage/Generation shows reference cards with toggleable "pin" state.
- [ ] Pinned references are appended to illustration prompts as style/context tokens.

**Verification:**
- [ ] Upload a character reference image, run vision analysis, and verify `visionSummary` is saved.
- [ ] Generate an illustration with the reference pinned; confirm prompt includes summary.

**Dependencies:** Task 3
**Estimated scope:** Medium (4–6 files)

---

### Phase 3: Print-Ready Export

#### Task 5: Add interior layout presets and on-canvas guides
**Description:** Render the four planned interior layouts and overlay bleed/safe-margin guides in the studio canvas.

**Acceptance criteria:**
- [ ] `pdf-builder.ts` supports the four layouts from the original plan:
  - Full-Bleed Art + Text Overlay Box
  - Top Art + Bottom Text
  - Split Spread (Left Text / Right Full Art)
  - Framed Illustration
- [ ] Each layout respects `marginPt` and uses `pageText` for text blocks.
- [ ] Export view shows a preview of the selected layout per asset.
- [ ] Optional red bleed lines and blue safe-margin guides rendered in the preview.

**Verification:**
- [ ] Export an interior PDF with each layout and verify text/art placement.
- [ ] Visual regression: guides appear in the preview canvas.

**Dependencies:** Task 1
**Estimated scope:** Medium (3–5 files)

---

#### Task 6: Add KDP cover wrap calculator and export
**Description:** Calculate paperback cover dimensions from page count and paper stock, then generate a separate cover-wrap PDF.

**Acceptance criteria:**
- [ ] New `calculateKdpCoverDimensions()` in `workspaceLogic.ts` takes trim size, page count, and paper stock (Standard/Premium color, White/Cream).
- [ ] Returns front width, back width, spine width, and bleed points.
- [ ] `POST /api/export/cover` generates a cover-wrap PDF with front cover art, spine text, and back-cover blurb/ISBN placeholder.
- [ ] Export view lets user pick cover asset and paper stock before exporting.
- [ ] Cover PDF dimensions match KDP specs within 0.001".

**Verification:**
- [ ] For a 24-page 8.5×8.5 book, spine width is calculated and cover PDF page size is correct.
- [ ] PDF is downloadable and viewable.

**Dependencies:** Task 1, Task 3
**Estimated scope:** Medium (3–5 files)

---

#### Task 7: Add DPI preflight and seller pack generator
**Description:** Warn users about low-resolution assets and produce a marketplace listing bundle.

**Acceptance criteria:**
- [ ] Preflight service checks each asset's pixel dimensions against trim size and flags anything below 250 DPI.
- [ ] Export view shows per-asset DPI status and a global preflight pass/fail.
- [ ] New `POST /api/export/seller-pack` generates: KDP title/subtitle options, 7 backend keywords, BISAC categories, back-cover blurb, and Etsy tags.
- [ ] Seller pack is bundled with interior PDF, cover PDF, and a preview PDF into a single `.zip`.
- [ ] ZIP is saved to `.data/exports/` and listed in Export view.

**Verification:**
- [ ] Run preflight on a low-resolution asset; warning appears.
- [ ] Generate seller pack; verify ZIP contains all four files.

**Dependencies:** Task 5, Task 6
**Estimated scope:** Medium–Large (4–6 files)

---

### Phase 4: Multi-Product Expansion

#### Task 8: Coloring-book line-art mode and puzzle generators
**Description:** Support coloring/activity books with deterministic puzzle pages and line-art prompts.

**Acceptance criteria:**
- [ ] When `product.category === 'coloring-book'`, illustration prompts are automatically suffixed with line-art rules (no shading, thick outlines).
- [ ] New `src/lib/puzzles/` modules for maze, themed word-search, and cryptogram generation.
- [ ] `POST /api/generate/puzzle` creates a puzzle asset as SVG/PNG for a given product and page number.
- [ ] Puzzle assets are included in export ordering like any other asset.

**Verification:**
- [ ] Create a coloring book product, generate a puzzle, and export a PDF with the puzzle page.
- [ ] Inspect puzzle output has no gray fill.

**Dependencies:** Task 3, Task 5
**Estimated scope:** Medium (3–5 files)

---

#### Task 9: Wall-art multi-ratio exporter and flashcards
**Description:** Add product blueprints for printable wall art and flashcards.

**Acceptance criteria:**
- [ ] New product category `wall-art` with ratio presets: `2:3`, `3:4`, `4:5`, `11x14`, `ISO A-series`.
- [ ] `POST /api/export/wall-art` takes an asset and outputs each ratio as a separate high-resolution PNG.
- [ ] New product category `flashcards` with 4-up/6-up duplex layout and crop marks.
- [ ] Export view exposes wall-art and flashcard options when the active product category matches.

**Verification:**
- [ ] Export a wall-art pack; verify all ratio files are generated.
- [ ] Export flashcards; verify crop marks and 4-up layout in PDF.

**Dependencies:** Task 3, Task 5
**Estimated scope:** Medium–Large (4–6 files)

---

### Phase 5: Background Automation

#### Task 10: Build Google Apps Script batch bridge
**Description:** Allow the job queue to run unattended via a 5-minute Apps Script trigger, removing the need to keep the browser open.

**Acceptance criteria:**
- [ ] `server/bridge/` contains `Code.gs` and `BatchTrigger.gs` templates.
- [ ] `POST /api/jobs/run-next` accepts an `X-Apps-Script` bearer token and validates it against stored `apps-script-trigger` tokens.
- [ ] `Code.gs` fetches the next queued job from the workspace and calls `/api/jobs/run-next` with the token.
- [ ] `BatchTrigger.gs` is a 5-minute time-driven trigger that runs `runNextJobTick()`.
- [ ] Identity view shows the generated bridge script and instructions for installing it in Apps Script.
- [ ] Concurrency is guarded by the existing single-job `run-next` design.

**Verification:**
- [ ] Create an `apps-script-trigger` token, install bridge, queue a job, and verify it completes without the client polling.
- [ ] Reject unauthorized bridge calls with `401`.

**Dependencies:** Task 2 (tokens), existing job queue
**Estimated scope:** Medium (3–5 files)

---

## Checkpoints

### Checkpoint: After Phase 1
- [ ] `tsc --noEmit` passes.
- [ ] Workspace loads with new fields.
- [ ] Cost logging is working end-to-end.

### Checkpoint: After Phase 2
- [ ] PNG illustrations can be generated and exported.
- [ ] Reference images produce vision summaries and influence prompts.

### Checkpoint: After Phase 3
- [ ] KDP interior + cover PDFs meet print specs.
- [ ] Seller pack ZIP contains all required marketplace files.

### Checkpoint: After Phase 4
- [ ] Coloring-book and wall-art products export correctly.

### Checkpoint: After Phase 5
- [ ] Apps Script bridge processes queued jobs unattended.
- [ ] All existing tests pass (or new tests added).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| OpenRouter image endpoint rate limits or model availability | High | Fall back to SVG generation and cache image results locally |
| Adding `pages` fields to `assets` later requires migration | Medium | Keep migration helper in `store.ts` that coerces old assets to new schema |
| Cover wrap math is exact; small rounding errors fail KDP | High | Unit-test cover dimensions against KDP's published formulas |
| Apps Script bridge exposes `/api/jobs/run-next` | Medium | Scope token to `apps-script-trigger` and require bearer validation |
| SVG-to-PNG rasterization is browser-dependent | Medium | Use server-side `resvg` or high-resolution canvas fallback |

## Open Questions

1. Should the app migrate to a separate `Pages` collection now, or keep the asset-centric model through Phase 3?
2. Which image model should be the default for raster illustrations (Gemini Imagen 3, DALL·E 3, FLUX via OpenRouter)?
3. Is Vercel/Next.js still a desired target, or should the local stack remain the primary product?
