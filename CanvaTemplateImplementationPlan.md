# Document Template Canvas Builder — Implementation Plan

**Version 1.0 | April 2026 | Engineering execution companion to CanvaTemplateSpec.md**

---

## 1. Purpose of this implementation plan

This document translates the canonical architecture specification (`CanvaTemplateSpec.md`) into engineering execution phases. It does not restate the product spec. It answers the question: in what order do we build things, what can we defer, and what must never be compromised.

**This plan does three things:**

1. Defines a sequenced build order where every phase ships working software against the canonical architecture — not working software that will need to be torn apart later.
2. Identifies long-term architecture contracts that must be honored from day one, even when feature surface is small.
3. Explicitly names the shortcuts that will be tempting and forbids them.

**What is allowed under this plan:**
- Reduced feature surface in early phases (fewer document types, fewer blocks, fewer locales)
- Mock or simplified implementations of non-core subsystems (e.g. heuristic page calculation before exact server-side page model)
- Incremental inspector UI, minimal first-pass block library

**What is not allowed under this plan:**
- Any phase that creates structural refactor debt (e.g. a document-type-specific rendering path)
- Any shortcut that violates canonical invariants defined in Section 2
- Any "we'll fix it later" architecture decision involving the render pipeline, schema contract, or version model

---

## 2. Canonical invariants that implementation must never break

These are non-negotiable. Every engineering decision must be checked against this list.

---

### INV-1: RenderContext isolation

**What it means**: The renderer (`DocumentTemplateRenderer`) accepts `{ templateDraft, dataContext, renderCtx? }` and nothing else. It never imports from the editor store, never reads Sequelize entities, never calls API endpoints.

**Why it matters**: The renderer runs in four environments — editor preview, screen view, server-side HTML render, PDF generation. Any environment-specific dependency makes it impossible to share across all four without forks.

**Forbidden shortcut**: Passing the full Redux store, or a Sequelize `Document` instance, or raw API response objects directly into renderer props. This always starts as "temporary" and becomes permanent.

**Correct alternative**: `RenderContextMapper` service (backend) and `RenderContext builder` (frontend) transform domain objects into a clean `DataContext` object before passing to renderer.

---

### INV-2: Template schema stability

**What it means**: The canonical template schema (as defined in the spec) is the single source of truth. It is stored as JSONB, parsed into typed objects, and passed through the pipeline. No part of the system should interpret template content by reading from `template.sections[0]` raw without parsing against the schema contract.

**Why it matters**: Schema must be migratable. If backend services interpret schema ad-hoc, a schema version bump becomes a global search-and-replace.

**Forbidden shortcut**: Services accessing `template.canvas.sections` as untyped JSON and hardcoding section-key string comparisons. This couples every service to every schema version simultaneously.

**Correct alternative**: A `TemplateVersionParser` utility that deserializes JSONB into fully typed `TemplateVersionDraft` objects. All services operate on typed objects only.

---

### INV-3: Block registry centralization

**What it means**: Every block type must be registered in `BlockRegistry`. No block type may exist in frontend or backend code that is not in the registry. The registry defines: block type key, allowed document types, required capability flags, default schema, property schema, render component.

**Why it matters**: The moment a block is defined outside the registry, it becomes invisible to the compliance engine, the validation service, and the capability check. You get silent failures.

**Forbidden shortcut**: Creating a new block as a React component and referencing it directly in a section renderer by string matching, bypassing the registry lookup.

**Correct alternative**: Every new block starts with a registry entry. Renderer resolves block type → component via registry. Backend validates block types via registry. Both use the same registry definition (shared as JSON schema or equivalent).

---

### INV-4: Renderer purity

**What it means**: Given identical inputs (`templateDraft`, `dataContext`, `renderCtx`), the renderer must produce identical output every time. No internal state, no side effects, no date/time reads, no environment checks.

**Why it matters**: Preview accuracy and PDF accuracy depend on this. If the renderer behaves differently on client vs server, you get preview/PDF divergence — the most common and most damaging failure mode in document systems.

**Forbidden shortcut**: `new Date()` inside a renderer component, reading `window.location`, reading localStorage, referencing any singleton store inside renderer components.

**Correct alternative**: All time-dependent values (today's date, session locale) are resolved before renderer invocation and passed in via `dataContext`.

---

### INV-5: Draft/published immutable version model

**What it means**: A published `TemplateVersion` is immutable. Its `content` JSONB field is never updated after creation. A document issued against `templateVersionId: 42` must render identically in 3 years using the snapshot from that version.

**Why it matters**: Legal and audit requirement. A corrective invoice must reference the original document as it was, rendered with the same template it was issued with.

**Forbidden shortcut**: Updating `template_versions.content` in-place when "minor fixes" are needed. Always create a new version, even for typo fixes.

**Correct alternative**: Edit → creates draft → publish → creates new immutable version → optionally set as active. No exceptions.

---

### INV-6: Preview/PDF page model alignment

**What it means**: The page model used to estimate page breaks in the editor must be derived from the same logic as the authoritative page model used for PDF generation. They may differ in precision (heuristic vs exact), but must share the same conceptual model: same section fragmentation rules, same table overflow logic, same header-repeat rules.

**Why it matters**: If preview shows 1 page and PDF produces 2, the system is broken for the user's purpose. The "WYSIWYG = print-accurate" principle fails.

**Forbidden shortcut**: Writing a completely separate page-break algorithm for the editor that is visually approximate without shared code with the server-side page calculator.

**Correct alternative**: A `PageCalculator` module that is framework-agnostic, usable both in the frontend (heuristic mode) and in the backend render pipeline (exact mode). Shared logic, different precision inputs.

---

### INV-7: No document-type-specific editors

**What it means**: There is one editor. It does not have an "invoice mode", "warehouse mode", "offer mode". Document type capability flags configure what sections, blocks, and columns are available. The editor shell is type-agnostic.

**Why it matters**: The moment you fork the editor per document type, you double the maintenance surface. You also violate the invariant that one template architecture covers all document types.

**Forbidden shortcut**: `if (documentType === 'faktura_vat') { renderInvoiceEditor() } else { renderGenericEditor() }`.

**Correct alternative**: `DocumentTypeCapabilitySchema` drives what the editor shows. The editor shell reads capabilities and adjusts what is available. Logic lives in data, not in conditionals.

---

## 3. Implementation assumptions

These are the explicit assumptions under which this plan is written. If any changes, revisit the affected milestones.

| # | Assumption |
|---|---|
| A1 | Backend is Node.js + Express + Sequelize + PostgreSQL. New template system shares the DB. |
| A2 | Frontend is React 19 with Redux Toolkit + RTK Query. New editor uses Zustand for local editor state (not RTK). |
| A3 | PDF generation uses Puppeteer (headless Chrome). No WeasyPrint. |
| A4 | The renderer is a shared React component tree, used on client and rendered server-side via `renderToStaticMarkup`. |
| A5 | Poland-first. Initial locales: `pl` and `en`. German and Ukrainian are Phase 2+. |
| A6 | First rollout supports: `faktura_vat`, `oferta`, `zamowienie`, `wz`. All other types come after architecture is proven. |
| A7 | Current system has existing document types (orders, invoices) but no canonical template builder yet. |
| A8 | Warehouse documents (`pz`, `mm`, `rw`, `pw`) are Phase 2 — architecture must support them, but they need not be delivered in Phase 1. |
| A9 | KSeF integration fields are Phase 2+. KSeF field bindings must be pre-registered in the schema, but the KSeF submission pipeline is out of scope here. |
| A10 | No external design system dependency. UI uses existing dark glass component library already in the product. |
| A11 | Template system is net-new. No migration from a prior template system required. |
| A12 | Multi-tenancy is enforced by `company_id` on all template records (existing pattern). |

---

## 4. Recommended implementation strategy

**Decision: Foundation-first layered implementation.**

The three options:

| Strategy | Description | Problem |
|---|---|---|
| Big bang | Design and build the full system simultaneously | Unshippable for 4+ months. No early feedback. High risk of systemic rework. |
| Vertical slice | Each slice delivers one user-facing flow end-to-end | Risk of divergent foundations per slice. Creates exactly the document-type-specific forks this architecture must avoid. |
| Foundation-first layered | Build canonical contracts, then backend, then renderer, then editor, then document types | Slower to first user-visible feature but produces a stable base for every subsequent feature at full speed. |

**Why foundation-first is the correct choice here:**

The canonical invariants (Section 2) require that contracts between subsystems are established before any subsystem is built. The renderer must consume a contract. The editor must produce a contract. The validation service must operate against a contract. If you build a vertical slice first (e.g. "full Faktura VAT flow"), you will inevitably hardcode the contract to that document type's shape and then refactor when the second document type arrives.

The one modification to pure foundation-first: each foundation layer is built together with its first real consumer. You do not build an abstract block registry and then leave it unused. You build the block registry and simultaneously implement the first 5 blocks against it. This prevents over-engineering foundations that don't reflect real usage.

---

## 5. Milestone roadmap

### M1 — Canonical Contracts
**Goal**: Define all shared contracts in code before any feature work. No moving parts yet. Just typed interfaces, schemas, and registries.

**Deliverables**:
- `TemplateVersionDraft` TypeScript interface (or JSDoc) — full schema contract
- `DataContext` interface — all namespaces (`company.*`, `document.*`, `items[*].*`, etc.)
- `RenderContext` interface — defines what the editor passes to the renderer
- `BlockRegistryEntry` interface
- `DocumentTypeCapabilitySchema` interface
- `ValidationIssue` interface with severity levels
- `PageModel` interface
- First committed JSON Schema for template JSONB structure
- First `DocumentTypeRegistry` seed data for `faktura_vat`, `oferta`, `zamowienie`, `wz`

**Dependencies**: None. This is the root.

**Risks**: Premature finalization of interfaces that will need to change. Mitigation: keep interfaces minimal — only what is currently needed, not everything the spec describes.

**Out of scope**: Any implementation code, API endpoints, UI components.

**Success criteria**: A developer can import `TemplateVersionDraft` and have full type coverage for any code touching template schema. Registry JSON passes a JSON Schema validation test.

---

### M2 — Backend Foundation
**Goal**: Database models, migrations, and core services exist. No API surface yet.

**Deliverables**:
- `templates` + `template_versions` + `template_version_content` migrations and Sequelize models
- `TemplateVersionParser` utility (JSONB → typed `TemplateVersionDraft`)
- `BlockRegistry` loaded from seed/config at startup
- `DocumentTypeRegistry` loaded from seed/config at startup
- `template.service` — CRUD, draft management
- `templateVersion.service` — create, get, list versions
- `validation.service` — structural validation (schema check), legal required binding check
- Unit tests for `TemplateVersionParser` and `validation.service`

**Dependencies**: M1 contracts

**Risks**: Sequelize JSONB handling quirks. Mitigation: wrap all JSONB access in `TemplateVersionParser`, never access raw.

**Out of scope**: Render service, PDF service, any API endpoints.

**Success criteria**: Can create a template record, save a draft version, run structural validation against it, retrieve typed `TemplateVersionDraft` from DB — all via service-layer unit tests.

---

### M3 — Frontend Editor Shell
**Goal**: The editor application shell exists as a navigable React app with correct state architecture. No real renderer yet.

**Deliverables**:
- `EditorStore` (Zustand) — full shape as per spec Section N, populated with empty/placeholder data
- `useEditorSelection`, `useEditorHistory`, `useEditorValidation` hooks (wired to store)
- `CommandBus` — apply command, push to history, update store
- Editor page layout: left panel (tabs), top bar, canvas area (placeholder), right panel
- Left panel: Sections tab with mock section list, Blocks tab with mock block library
- Top bar: save status chip, undo/redo buttons (wired), locale switcher (stored, not yet applied), mode toggle
- RTK Query endpoint for template CRUD (load/save draft)
- Navigation: Company Settings → Templates list → Template editor

**Dependencies**: M1 contracts, M2 backend services (needs basic template CRUD API)

**Risks**: Getting editor state shape wrong now causes expensive refactors later. Mitigation: implement full store shape from M1 contracts even if most fields are empty initially.

**Out of scope**: Actual canvas rendering, block components, right panel properties.

**Success criteria**: Editor page loads for a given template ID. Undo/redo cycles through empty command history. Switching locale in top bar updates `ui.localeMode` in store. Autosave fires and calls draft save API.

---

### M4 — Shared Renderer + Preview/PDF
**Goal**: One renderer that works in all four contexts. Preview API and PDF API exist.

**Deliverables**:
- `DocumentTemplateRenderer` React component — pure, accepts `(templateDraft, dataContext, renderCtx?)`
- Implements: header section, seller/buyer section, document meta section, notes section, footer section (items table deferred to M5)
- `SampleDataProvider` — returns realistic `DataContext` for each document type
- `RenderContextMapper` (backend) — maps `Document` + `Company` + `Counterparty` Sequelize entities → `DataContext`
- `render.service` — server-side `renderToStaticMarkup` wrapper
- `preview.service` — renders with sample data, returns HTML; caches by `content_hash`
- `pdf.service` — Puppeteer instance, accepts HTML → PDF/A buffer
- `GET /api/templates/:id/preview` — returns rendered HTML iframe content
- `POST /api/render/document` — renders document with real data
- `GET /api/documents/:id/pdf` — returns PDF stream

**Dependencies**: M1, M2, M3 (renderer must be usable in editor shell for canvas)

**Risks**: Preview/PDF divergence from day one if Puppeteer CSS differs from browser. Mitigation: set up a visual regression test with one sample document in this milestone — catch divergence early.

**Out of scope**: Page engine / page splitting (single-page only in this milestone), items table.

**Success criteria**: `GET /api/templates/:id/preview` returns an HTML document that when viewed in an iframe matches the canvas preview in the editor. PDF output for a sample document with no items table passes visual review. Server-side and client-side renders produce identical HTML for same inputs.

---

### M5 — Faktura VAT + Oferta
**Goal**: First two document types fully functional end-to-end. Users can create, customize, preview, PDF, and publish.

**Deliverables**:
- Items table renderer — dynamic columns, VAT columns, computed cells, repeating header placeholder
- Totals section renderer — by-VAT-rate breakdown
- Payment section renderer — payment method, bank account, due date
- Legal footer section — locked, system-provided text
- Block library UI (left panel) — first 12 blocks available and draggable
- Right panel inspector — section settings, block property panels for all Phase 1 blocks
- Binding picker UI — searchable tree, suggested bindings, sample value display, token chip insertion
- `POST /api/templates/:id/publish` — validation run, immutable version creation
- `PUT /api/templates/:id/set-active-version` — activate a version
- `faktura_vat` and `oferta` capability schemas in registry
- System default templates for both document types
- Validation: required bindings check shows amber warnings on canvas, blocks publish if BLOCKING issues exist
- Print preview mode in editor (multi-page from server render)

**Dependencies**: M4 (renderer), M3 (editor shell)

**Risks**: Items table is the most complex renderer component. Risk: underestimating overflow/pagination complexity. Mitigation: in this milestone, items table renders on a single page (overflow clip is acceptable as a known limitation). Page splitting for items table comes in M6.

**Out of scope**: Column editor for items table, version history UI, rollback.

**Success criteria**: A user can open the editor, load the default `faktura_vat` template, customize colors and logo size, bind all required fields (pre-bound in default), preview with sample data (including multi-item invoice), publish, and download a PDF that matches the canvas preview.

---

### M6 — Orders + WZ Pattern
**Goal**: Prove the architecture generalizes. Add `zamowienie` and `wz` without touching editor shell or renderer core.

**Deliverables**:
- `zamowienie` and `wz` capability schemas in registry
- Warehouse blocks: `WarehouseBlock`, `CarrierBlock`, `GoodsReceiptBlock`
- Items table: warehouse column preset (no price, no VAT, batch + expiry columns)
- Column editor UI in right panel (enable/disable columns, reorder, label override)
- Items table: basic multi-page behavior — table header repeats on page 2+, totals section always on last page
- `PageCalculator` module — heuristic mode for editor, exact mode wired to server render
- System default templates for `zamowienie` and `wz`

**Dependencies**: M5

**Risks**: Multi-page items table. This is the hardest rendering problem in the system. Mitigation: authoritative page model is server-side only in this milestone. Editor shows estimated page break hints (heuristic). Divergence is acceptable temporarily.

**Out of scope**: Perfect heuristic/exact alignment (Phase 2), remaining warehouse types (pz, mm, rw, pw).

**Success criteria**: User can create a WZ template with warehouse columns, no price data. A document with 30+ line items renders across multiple pages with table header repeating correctly in PDF. Editor shows estimated page break location.

---

### M7 — Advanced Editor UX
**Goal**: Make the editor genuinely good, not just functional. Field-level editing, drag-and-drop polish, keyboard navigation.

**Deliverables**:
- Field-level selection within blocks (`selectedFieldKey` in store, field property panel)
- Field width resize (mouse drag, live tooltip, snap to common fractions)
- Field reorder within block via `@dnd-kit` (insert-style, stable selection after reorder)
- Font size per field
- Block-level DnD polish: cross-section drag, drop zone indicators
- Keyboard shortcuts: Tab/Shift+Tab, Cmd+D, Cmd+], Delete
- Smart column snapping (1/2, 1/3, 2/3, etc.)
- `SectionInspector` extracted as standalone component
- `useBlockInteractions` hook extracted
- Zoom control (50/75/100/Fit) wired to canvas
- Ruler display (optional, Cmd+Shift+R)

**Dependencies**: M5 (stable block library), M6 (column editor as reference)

**Risks**: DnD complexity. Mitigation: @dnd-kit is already in use in this codebase. Follow existing patterns.

**Out of scope**: ResizeObserver-based selection rects (deferred to M9+), multi-block selection.

**Success criteria**: A power user can build a complete custom `faktura_vat` template from scratch (not from default) within 20 minutes, using only keyboard + mouse in the editor. No crashes on section switch, template reload, or mode toggle.

---

### M8 — Governance and Version Tooling
**Goal**: Template governance is production-grade.

**Deliverables**:
- Version history panel in editor (list of published versions with date, publisher, changelog)
- Rollback action (set prior version as active)
- Version comparison view (structured diff: changed sections, changed bindings, changed style tokens)
- Company override model (duplicate system template → company template)
- System default template update notification (banner when system template is updated)
- `archived` status + archive action
- Template list page: filters by document type, status; shows active version number

**Dependencies**: M5 (publish flow must be stable first)

**Risks**: Version comparison UI is complex. Mitigation: start with a simplified "what changed" summary (list of changed keys) before a full side-by-side view.

**Out of scope**: Permission role assignments (use existing company membership model), audit log.

**Success criteria**: Admin can view full publish history, roll back to any prior version, and compare two versions. Rollback takes effect for new document issues within 1 minute.

---

### M9 — Compliance / KSeF Layer
**Goal**: Legal compliance is enforced by the system, not by user discipline.

**Deliverables**:
- `LegalConstraintRuleSet` for `PL_VAT_2024` — BLOCKING and WARNING rules for `faktura_vat`
- Compliance engine wired into `validation.service`
- Canvas warning indicators: amber `⚠` chip on block, dot on section header
- Right panel "Legal status" section
- Polish-market aware field hints (bound to binding picker for ~15 key fields)
- KSeF-readiness indicator in right panel (advisory only)
- `KSeFReferenceBlock` and `KSeFQRBlock` registered (bindings defined, render component implemented)
- Pre-publish validation summary modal — blocking vs warning vs info, each with navigation to offending block

**Dependencies**: M5 (validation flow must exist), M2 (`validation.service` extensible)

**Risks**: Legal accuracy of compliance rules. Mitigation: rules-as-data structure means non-engineer can review and update rules without code changes.

**Out of scope**: KSeF submission pipeline, KSeF FA(2) schema validation.

**Success criteria**: Publishing a `faktura_vat` template with `company.nip` unbound is blocked. Publishing with `counterparty.nip` unbound shows a WARNING but is allowed. The pre-publish modal lists all issues with correct severity.

---

### M10 — Scale-out to Additional Document Types
**Goal**: Add remaining document types using only capability config — no new editor code.

**Deliverables**:
- `faktura_zaliczkowa`, `faktura_korygujaca`, `faktura_koncowa` — capability schemas + system defaults
- Correction reference block, advance invoice reference block
- `pz`, `mm`, `rw`, `pw` — warehouse capability schemas + system defaults
- `nota_korygujaca`, `nota_ksiegowa`
- Bilingual PL/EN template preset
- Locale: `de` support in renderer and localization system
- PaymentQR block (print/PDF channel only)

**Dependencies**: M6 (WZ pattern), M9 (compliance layer)

**Out of scope**: Custom computed fields, formula engine.

**Success criteria**: All 15 document types listed in the spec are available in the editor. Adding a new document type requires only: a capability schema entry, a system default template JSON, and optionally new block components. No editor shell changes needed.

---

### Milestone dependency map

```
M1 ──► M2 ──► M4 ──► M5 ──► M6 ──► M7
         │              │         │
         └──► M3 ──────►│         └──► M8 ──► M9 ──► M10
```

---

## 6. Build order by subsystem

| # | Subsystem | Stage | Depends on | Unlocks |
|---|---|---|---|---|
| 1 | Canonical contracts (TypeScript interfaces, JSON Schema) | M1 | Nothing | Everything |
| 2 | DocumentTypeRegistry | M1 | Contracts | Capability checks, block library filtering, validation |
| 3 | BlockRegistry | M1 | Contracts | Renderer, validation, capability checks |
| 4 | TemplateVersionParser | M2 | Contracts | All backend services |
| 5 | Template persistence (models, migrations, CRUD service) | M2 | Contracts | All backend work |
| 6 | Validation service (structural) | M2 | Parser, Registry | Publish gate |
| 7 | RenderContextMapper | M4 | Contracts, models | Preview API, render service |
| 8 | Shared renderer (core sections) | M4 | Contracts | Editor canvas, preview, PDF |
| 9 | Preview API | M4 | Renderer, render service | Editor iframe preview |
| 10 | PDF API + Puppeteer service | M4 | Renderer, render service | Document PDF export |
| 11 | PageCalculator (heuristic) | M6 | Renderer | Editor page break hints |
| 12 | PageCalculator (exact, server-side) | M6 | Renderer, PDF pipeline | Accurate multi-page PDF |
| 13 | Frontend editor shell | M3 | Contracts | All frontend work |
| 14 | EditorStore + CommandBus + history | M3 | Editor shell | Undo/redo, all mutations |
| 15 | Selection model hooks | M3 | EditorStore | Inspector, field editing |
| 16 | Block library UI | M5 | Editor shell, BlockRegistry | Adding blocks to canvas |
| 17 | Inspector panels (section + block) | M5 | Selection model, BlockRegistry | Block properties editing |
| 18 | Binding picker UI | M5 | DataContext contracts | Token binding in text blocks |
| 19 | Items table subsystem (renderer) | M5 | Renderer, contracts | faktura_vat functional |
| 20 | Items table subsystem (column editor UI) | M6 | Inspector panels | WZ/order column presets |
| 21 | Publish flow + version creation | M5 | Validation service, template persistence | Templates go live |
| 22 | Version history / governance UI | M8 | Publish flow | Rollback, version compare |
| 23 | Compliance rules engine | M9 | Validation service, DocumentTypeRegistry | Legal warning indicators |
| 24 | Field-level editing (DnD + resize) | M7 | Editor shell, renderer | Power UX for header fields |
| 25 | SectionInspector extraction | M7 | Inspector panels | Maintainable inspector |

---

## 7. Backend implementation plan

### Database schema

```sql
-- Core template record
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  document_type_key VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(32) NOT NULL DEFAULT 'draft',  -- draft | published | archived
  scope           VARCHAR(32) NOT NULL DEFAULT 'custom', -- system_default | company_default | custom
  current_version_id UUID,  -- FK set after first publish
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Version metadata (lightweight, always loaded)
CREATE TABLE template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES templates(id),
  version_number  INTEGER NOT NULL,
  schema_version  VARCHAR(16) NOT NULL DEFAULT '1',
  status          VARCHAR(32) NOT NULL DEFAULT 'published',
  content_hash    VARCHAR(64) NOT NULL,
  publisher_id    UUID REFERENCES users(id),
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changelog       TEXT,
  UNIQUE(template_id, version_number)
);

-- Version content (heavy JSONB, loaded only when needed)
CREATE TABLE template_version_content (
  template_version_id UUID PRIMARY KEY REFERENCES template_versions(id),
  content         JSONB NOT NULL
);

-- Draft storage (one per template, overwritten on each autosave)
CREATE TABLE template_drafts (
  template_id     UUID PRIMARY KEY REFERENCES templates(id),
  content         JSONB NOT NULL,
  schema_version  VARCHAR(16) NOT NULL DEFAULT '1',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id)
);
```

**Why separate `template_version_content`**: Version metadata is queried frequently (list all versions, check current version ID). Content is multi-KB JSONB — only load when actually rendering or editing. Separation prevents N+1 loading of large JSONB on list queries.

**Why `template_drafts` is separate from `template_versions`**: Draft is mutable and ephemeral. Version records are immutable. Keeping them separate prevents accidental mutation of published versions.

---

### Proposed module structure

```
server/src/
  services/documents/
    templateRegistry/
      documentTypeRegistry.js      — loads and exposes DocumentTypeCapabilitySchema per doc type
      blockRegistry.js             — loads and exposes BlockRegistryEntry per block type
      capabilityResolver.js        — resolves what is allowed/required for a given doc type
    template/
      template.service.js          — CRUD: create, get, list, update meta
      templateDraft.service.js     — save draft, get draft, autosave logic
      templateVersion.service.js   — create version (on publish), get version, list versions
      templateVersionParser.js     — JSONB → typed TemplateVersionDraft, version migration
    validation/
      validation.service.js        — orchestrates all validation passes
      structuralValidator.js       — schema structure check (JSON Schema based)
      bindingValidator.js          — required bindings check against DataContext schema
      complianceValidator.js       — legal rules engine, severity classification
      complianceRules/
        PL_VAT_2024.json           — rule set for faktura_vat
        PL_WZ.json                 — rule set for WZ
    render/
      render.service.js            — server-side renderToStaticMarkup wrapper
      renderContextMapper.js       — Sequelize entities → DataContext (per doc type)
      sampleDataProvider.js        — returns realistic DataContext per doc type for preview
      pageCalculator.js            — heuristic + exact page model
    preview/
      preview.service.js           — render with sample data, cache by content_hash
      previewCache.js              — in-memory or Redis cache (content_hash → HTML)
    pdf/
      pdf.service.js               — Puppeteer instance, HTML → PDF buffer
      pdfOptions.js                — A4, margins, print CSS settings

  controllers/documents/
    template.controller.js
    templateVersion.controller.js
    render.controller.js
    preview.controller.js

  routes/documents/
    templateRouter.js
    renderRouter.js
```

---

### Service responsibility matrix

| Service | Owns | Does NOT own |
|---|---|---|
| `template.service` | Template CRUD, status transitions | Version content, validation |
| `templateDraft.service` | Draft save/load, autosave debounce | Publishing, version creation |
| `templateVersion.service` | Immutable version creation, activation, history | Draft management, content parsing |
| `templateVersionParser` | JSONB → typed TS objects, schema migration | DB access |
| `validation.service` | Orchestrating all validators, issue aggregation | DB access, rendering |
| `structuralValidator` | JSON Schema conformance check | Business rules |
| `complianceValidator` | Legal and business rules evaluation | Structural checks |
| `render.service` | Server-side React render | PDF generation, data resolution |
| `renderContextMapper` | Entity → DataContext transformation | Rendering |
| `pdf.service` | Puppeteer lifecycle, HTML → PDF | HTML generation |
| `preview.service` | Sample data injection, cache, preview pipeline | PDF, real-data rendering |
| `documentTypeRegistry` | Static config: capabilities, required sections | Runtime state |
| `blockRegistry` | Static config: block types, property schemas | Runtime state |

---

### API endpoint list

```
# Template management
GET    /api/templates                           — list templates for company (filtered by docType, status)
POST   /api/templates                           — create new template (docType, name, startFrom?)
GET    /api/templates/:id                       — get template + current draft
PUT    /api/templates/:id                       — update template meta (name, description)
DELETE /api/templates/:id                       — archive template

# Draft
GET    /api/templates/:id/draft                 — get current draft content
PUT    /api/templates/:id/draft                 — save draft content (autosave + manual)

# Validation
POST   /api/templates/:id/validate              — run full validation, return issues

# Publishing
POST   /api/templates/:id/publish               — validate + create immutable version + set active
GET    /api/templates/:id/versions              — list all versions
GET    /api/templates/:id/versions/:versionId   — get specific version content
POST   /api/templates/:id/versions/:versionId/activate  — set as active version (rollback)

# Preview
GET    /api/templates/:id/preview               — HTML preview with sample data (cached)
GET    /api/templates/:id/preview?versionId=    — preview specific version

# Render (document-level)
POST   /api/render/document                     — render document with real data (returns HTML)
GET    /api/documents/:id/pdf                   — PDF for issued document
GET    /api/documents/:id/preview               — HTML preview for issued document

# Registry (read-only, no auth required for frontend bootstrap)
GET    /api/template-registry/document-types    — list all document types + capabilities
GET    /api/template-registry/blocks            — list all block types + property schemas
```

---

### Publish flow

```
POST /api/templates/:id/publish
  1. Load draft from template_drafts
  2. Parse draft via templateVersionParser
  3. Run validation.service.validateFull(draft, docTypeCapabilities)
     a. structuralValidator
     b. bindingValidator
     c. complianceValidator
  4. If any BLOCKING issues → return 422 with issues list
  5. WARNING issues → include in response, proceed
  6. Compute content_hash (SHA256 of canonical JSON string)
  7. Get next version_number (MAX(version_number) + 1 for this template)
  8. INSERT into template_versions (metadata)
  9. INSERT into template_version_content (content JSONB)
  10. UPDATE templates SET current_version_id = new version, status = 'published'
  11. Return { versionId, versionNumber, issues (warnings only) }
```

---

### Registry loading strategy

Registries are loaded at server startup from JSON config files (not from DB). This means:
- Zero latency on registry lookups (in-memory)
- Registry updates require deploy (acceptable for Phase 1+2; rule-driven compliance engine handles the legal-rules-change case without deploy)
- Seed files are version-controlled and reviewable

```js
// documentTypeRegistry.js
const registry = new Map();
const files = glob.sync('server/src/services/documents/templateRegistry/docTypes/*.json');
files.forEach(f => {
  const schema = JSON.parse(fs.readFileSync(f));
  registry.set(schema.key, schema);
});
```

---

## 8. Frontend implementation plan

### Editor shell composition

```
DocumentTemplateEditorPage/
  index.js                        — page entry, loads template, mounts editor
  DocumentTemplateEditorPage.module.css
  hooks/
    useEditorSelection.js         — selectedSectionKey, selectedBlockKey, selectedFieldKey + setters
    useEditorHistory.js           — undo, redo, canUndo, canRedo
    useEditorValidation.js        — issues, validate(), isValid
    useBlockInteractions.js       — all mouse handlers: drag, resize, field width
    useEditorPreview.js           — editorMode, localeMode, zoom, sampleData toggle
    useDocumentCapabilities.js    — wraps registry data for current document type
  components/
    TopBar/
      index.js
    LeftPanel/
      index.js
      SectionsTab.js
      BlockLibraryTab.js
      DataBindingsTab.js
    RightPanel/
      index.js
      SectionInspector.js
      BlockInspector.js
      FieldInspector.js
      DocumentSettingsPanel.js
      LegalStatusPanel.js
    Canvas/
      index.js
      SectionCard.js
      CanvasPlaceholder.js  (renders DocumentTemplateRenderer in iframe/div)
    PreviewMode/
      index.js
    PrintPreviewMode/
      index.js
```

---

### EditorStore shape (Zustand)

```js
// store/editorStore.js
const useEditorStore = create((set, get) => ({
  // Schema
  draft: null,                      // TemplateVersionDraft | null
  templateMeta: null,               // { id, name, documentTypeKey, status }

  // UI state
  ui: {
    selectedSectionKey: null,
    selectedBlockKey: null,
    selectedFieldKey: null,
    editorMode: 'design',           // 'design' | 'preview' | 'print'
    localeMode: 'pl',
    zoom: 1,
    showRulers: false,
    activeLeftTab: 'sections',
    rightPanelExpanded: true,
  },

  // Interaction state
  interaction: {
    dragState: null,
    resizeState: null,
    fieldWidthPending: null,
  },

  // History
  history: {
    past: [],                        // TemplateVersionDraft[] max 50
    future: [],
    savedHash: null,                 // hash of last saved draft
  },

  // Validation
  validation: {
    issues: [],
    lastValidated: null,
    isValid: null,
  },

  // Actions
  applyCommand: (command) => { /* push to history, apply to draft */ },
  setSelectedSection: (key) => { /* update ui.selectedSectionKey, clear block/field */ },
  setSelectedBlock: (key) => { /* update ui.selectedBlockKey, clear field */ },
  setSelectedField: (key) => { /* update ui.selectedFieldKey */ },
  setEditorMode: (mode) => { /* update ui.editorMode */ },
  setLocaleMode: (locale) => { /* update ui.localeMode */ },
  undo: () => { /* pop past, push to future, restore draft */ },
  redo: () => { /* pop future, push to past, apply draft */ },
  setValidationIssues: (issues) => { /* update validation */ },
  setFieldWidthPending: (state) => { /* update interaction.fieldWidthPending */ },
}));
```

---

### Command model

```js
// commands/index.js

// Each command is a plain object with apply() pure function
// apply() receives current draft, returns new draft (uses immer produce internally)

const SectionReorderCommand = ({ fromKey, toKey }) => ({
  type: 'SECTION_REORDER',
  apply: (draft) => produce(draft, d => { /* reorder sections */ }),
  describe: () => `Reorder section ${fromKey} → ${toKey}`,
});

const BlockAddCommand = ({ sectionKey, blockType, position }) => ({...});
const BlockRemoveCommand = ({ sectionKey, blockKey }) => ({...});
const FieldToggleCommand = ({ sectionKey, fieldKey, enabled }) => ({...});
const FieldReorderCommand = ({ sectionKey, fromKey, toKey }) => ({...});
const FieldWidthSetCommand = ({ sectionKey, fieldKey, widthPx }) => ({...});
const FieldFontSizeSetCommand = ({ sectionKey, fieldKey, fontSize }) => ({...});
const StyleTokenUpdateCommand = ({ tokenKey, value }) => ({...});
const BindingSetCommand = ({ blockKey, fieldKey, bindingPath, formatter }) => ({...});
const SectionSettingsUpdateCommand = ({ sectionKey, settings }) => ({...});
```

**History rule**: `applyCommand(cmd)` pushes current draft to `past`, applies `cmd.apply(draft)`, clears `future`. Undo pops from `past`, pushes current to `future`. Max 50 items in `past`.

---

### Selection model

Selection is hierarchical: section → block → field. Setting a lower-level selection requires parent to be selected. Setting a higher-level selection clears lower levels.

```js
// useEditorSelection.js
setSelectedSection(key)  → clears selectedBlockKey, selectedFieldKey
setSelectedBlock(key)    → requires selectedSectionKey; clears selectedFieldKey
setSelectedField(key)    → requires selectedBlockKey
clearSelection()         → clears all three
```

Right panel renders based on what is selected:
- Nothing selected → DocumentSettingsPanel
- Section selected → SectionInspector
- Block selected → BlockInspector
- Field selected → FieldInspector

---

### Panel composition

```
RightPanel
  ├── DocumentSettingsPanel     (when nothing selected)
  │     ├── PageSizeControl
  │     ├── MarginControl
  │     ├── LayoutPresetPicker
  │     └── NumberingPresetPicker
  ├── SectionInspector          (when section selected)
  │     ├── SectionNameField
  │     ├── LayoutModeControl
  │     ├── SpacingControl
  │     └── VisibilityRuleEditor
  ├── BlockInspector            (when block selected)
  │     ├── BlockPropertyPanel  (schema-driven, different per blockType)
  │     ├── StylePanel          (font, color, padding, alignment)
  │     ├── BindingPanel        (primary binding, fallback, formatter)
  │     └── ConditionsPanel     (visibility rule editor)
  ├── FieldInspector            (when field selected)
  │     ├── FieldLabelOverride
  │     ├── FontSizeControl
  │     ├── WidthDisplay+Clear
  │     └── EnabledToggle
  └── LegalStatusPanel          (always visible at bottom, collapsible)
        └── ValidationIssueList (filtered to selected block, or all if nothing selected)
```

---

### Schema-driven block property panels

Block property panels must not be hardcoded per block type. Use block registry property schema to drive the panel:

```js
// BlockPropertyPanel.js
function BlockPropertyPanel({ blockType, value, onChange }) {
  const registry = useBlockRegistry();
  const entry = registry.get(blockType);
  // entry.propertySchema is a JSON Schema defining editable props
  // Render generic form controls from schema
  return <SchemaForm schema={entry.propertySchema} value={value} onChange={onChange} />;
}
```

This means: adding a new block type with new properties requires only a registry update + SchemaForm field type support. No new panel component.

---

### Drag-drop integration

Use `@dnd-kit` at three nesting levels:

```
DndContext (canvas level)        — sections reorder
  ├── SortableContext (sections)
  │     └── SectionCard
  │           └── DndContext (section level)   — blocks within section, cross-section
  │                 └── SortableContext (blocks)
  │                       └── BlockCard
  │                             └── DndContext (block level)  — fields within block
  │                                   └── SortableContext (fields)
  │                                         └── BuilderInlineField
```

Each DndContext has its own `onDragEnd` handler that dispatches the appropriate command. Cross-section block moves use `useDroppable` on each section and custom collision detection.

---

### Preview mode

When `editorMode === 'preview'`:
- Left panel collapses to icon strip
- Right panel collapses to icon strip
- Canvas fills the available space
- `DocumentTemplateRenderer` receives `renderCtx = null` (no editing interactions)
- `DataContext` switches between sample data and company data based on toggle
- Locale switcher remains active

When `editorMode === 'print'`:
- Full-screen mode
- Fetches server-side rendered HTML (`GET /api/templates/:id/preview`)
- Embeds in iframe
- No editing possible
- Page split indicator lines visible

---

### Where to avoid premature complexity

- **Do not build SchemaForm generically from day one.** Start with hand-written property panels for the first 12 blocks. Extract SchemaForm pattern in M7.
- **Do not implement formula/computed field editor.** Display computed field values as read-only chips.
- **Do not implement multi-block selection.** Single-block selection is sufficient through M9.
- **Do not implement collaborative editing.** Single-user editor only.
- **Do not implement plugin architecture.** Block registry is sufficient. Plugin API is Phase 3+.

---

## 9. First document types to support

**Final recommendation: `faktura_vat` → `oferta` → `zamowienie` → `wz`**, in this exact order, in this rationale:

---

### faktura_vat — first

**Architecture pattern exercised**: Full sales document pattern. All core sections. Items table with VAT. Totals with VAT breakdown. Legal footer locked. Required bindings enforced.

**New complexity introduced**: Items table renderer (most complex component). VAT column set. `TotalsTableBlock` with by-rate breakdown. Legal footer as a locked system block.

**What it proves**: The renderer handles the hardest common case. The compliance engine catches missing legal fields. The publish flow creates an immutable version. The PDF output is legally usable.

**Why first**: It is the most common document type in Polish business. Every other invoicing-related type (`zaliczkowa`, `korygujaca`, `koncowa`) derives from it. Building it first exercises the maximum shared infrastructure.

---

### oferta — second

**Architecture pattern exercised**: Sales document without VAT requirement. Optional fields. Validity date block. No mandatory legal footer. Demonstrates capability flags suppress compliance rules.

**New complexity introduced**: Near zero. Reuses all faktura_vat infrastructure with a different capability schema and different default template. This is the first proof that the architecture generalizes without code changes.

**What it proves**: Adding a new document type requires only: capability schema JSON entry + system default template JSON. No new editor code, no new renderer code, no new inspector code.

---

### zamowienie — third

**Architecture pattern exercised**: Order document. Delivery address block. No totals required. Discount column in items table. Demonstrates the column preset system.

**New complexity introduced**: Column editor UI in right panel (enable/disable columns per document type). Delivery address block (new block type, but simple). Order reference field.

**What it proves**: Column editor works. Items table adapts to different column presets without new table component. Cross-family document types (order ≠ invoice) work in one editor.

---

### wz — fourth

**Architecture pattern exercised**: Warehouse document. No price/VAT columns. Warehouse source/destination blocks. GoodsReceipt block with signature lines. Completely different section set from invoicing.

**New complexity introduced**: Warehouse blocks (new block types). Items table with warehouse column preset (batch, expiry, no price). Signature blocks. Print-only elements.

**What it proves**: The full architectural claim: one editor, one renderer, one block library covers both commercial and warehouse documents. If WZ works cleanly, the architecture is validated.

---

## 10. Recommended first block set

| Block | Phase | Generic? | Required for |
|---|---|---|---|
| `DocumentTitleBlock` | M5 | Generic | All types |
| `DocumentNumberBlock` | M5 | Generic | All types |
| `DocumentDatesBlock` | M5 | Generic | All types |
| `CompanyLogoBlock` | M5 | Generic | All types |
| `CompanyIdentityBlock` (name + address + NIP/REGON) | M5 | Generic | All types |
| `CounterpartyIdentityBlock` (name + address + NIP) | M5 | Generic | All types |
| `ItemsTableBlock` | M5 | Configurable | faktura, oferta, zamowienie, wz |
| `TotalsTableBlock` | M5 | Sales-specific | faktura, oferta |
| `PaymentBlock` | M5 | Sales-specific | faktura, proforma |
| `NotesBlock` | M5 | Generic | All types |
| `LegalFooterBlock` | M5 | System-locked | faktura_vat (required), others optional |
| `SignatureBlock` | M6 | Generic | wz, zamowienie, oferta |
| `WarehouseBlock` | M6 | Warehouse-specific | wz, pz, mm |
| `GoodsReceiptBlock` | M6 | Warehouse-specific | wz, pz |
| `CarrierBlock` | M6 | Logistics-specific | wz, list_przewozowy |
| `AmountInWordsBlock` | M9 | Locale-specific | faktura_vat (advisory) |
| `PaymentQRBlock` | M10 | Print-only | faktura_vat (optional) |
| `KSeFReferenceBlock` | M9 | KSeF-specific | faktura_vat |

**Why these 12 blocks are Phase 1 (M5)**:
- Together they cover 100% of `faktura_vat` and `oferta` and 80% of `zamowienie`
- All are generic enough that no document-type-specific logic is needed inside the block components
- No block here requires formula evaluation or complex conditional logic
- They exercise every major block category: identity, meta, table, totals, payment, legal

---

## 11. Shared renderer plan

### The core rule

There is exactly one `DocumentTemplateRenderer` React component. It renders the same output in all four contexts:
1. Editor canvas (client-side, with `renderCtx` active)
2. Preview mode (client-side, `renderCtx` null)
3. Server-side preview API (`renderToStaticMarkup`, `renderCtx` null)
4. PDF generation (Puppeteer loads a page that mounts the renderer, `renderCtx` null)

### What must be shared

- Section render functions (`renderHeaderSection`, `renderItemsTableSection`, etc.)
- Block render components (every `*Block` component)
- Style token resolution (`resolveStyleTokens(styleTokens)` → CSS variables object)
- Page model types (shared between frontend heuristic and server exact)

### What may differ per context

| Aspect | Editor | Server/PDF |
|---|---|---|
| `renderCtx` | Active (field selection, DnD hooks) | Null |
| `dataContext` | Sample data or partial real data | Full real data |
| CSS delivery | CSS Modules (client-side) | Inlined styles (for PDF) |
| Font loading | Browser | Puppeteer font config |
| Image loading | Signed URLs | Pre-resolved absolute URLs |

### CSS strategy for PDF

CSS Modules work in the browser. In Puppeteer, the page is a real browser — CSS Modules work if the HTML includes the correct stylesheet links or if styles are inlined. **Recommendation**: For server-side render, use a CSS inliner (e.g. `juice`) to inline all CSS into the HTML string before passing to Puppeteer. This avoids any external asset loading in Puppeteer.

Alternatively, use a single dedicated print stylesheet that is scoped only to the document canvas, separate from editor chrome styles. This is cleaner long-term.

### Where rendering bugs usually happen

1. **Font rendering mismatch**: Browser uses system font fallback, Puppeteer uses Chromium's bundled fonts. Fix: embed fonts via `@font-face` with base64 data URIs in the render stylesheet.
2. **Date formatting difference**: `new Date()` calls inside renderer produce different values on server (UTC) vs client (local timezone). Fix: pass `today` in `dataContext`, never call `new Date()` in renderer.
3. **CSS Grid/Flex behavior**: Page layout computed by browser may differ between Chrome versions. Fix: pin Puppeteer's Chromium version in `package.json`.
4. **Image loading timing**: Puppeteer may generate PDF before images load. Fix: `page.waitForNetworkIdle()` or `waitUntil: 'networkidle0'` in Puppeteer config.
5. **Page break mid-block**: CSS `page-break-inside: avoid` not always respected. Fix: use the `PageCalculator` to manually place page breaks, don't rely solely on CSS.

### How to avoid preview/PDF divergence

Set up a regression test suite in M4: for each system default template, render HTML (client) and PDF (server), extract page 1 as PNG (Puppeteer screenshot), and compare pixel-by-pixel against a stored baseline. Run this in CI. Any divergence fails the build.

---

## 12. Page engine plan

### The two-track model

| Track | Where | Precision | When used |
|---|---|---|---|
| Heuristic | Frontend (client) | ±1 page | Editor page break hints |
| Exact | Backend (server) | Pixel-perfect | Print preview, PDF |

**Both tracks must be implemented from the same `PageCalculator` module logic.** The heuristic track uses estimated heights; the exact track uses Puppeteer's layout engine.

---

### PageCalculator module

```js
// pageCalculator.js

// Shared input model
PageCalculatorInput {
  sections: SectionFragment[]    // ordered, includes all sections
  pageSettings: PageSettings     // A4, margins, headerRepeatHeight
  itemRowHeight: number          // estimated (heuristic) or measured (exact)
  itemCount: number
}

// Output model
PageModel {
  pages: Page[]
  pageCount: number
}

Page {
  pageNumber: number
  sections: PageSection[]        // which sections/fragments appear on this page
}

PageSection {
  sectionKey: string
  fragmentStart: number          // first item index if items table
  fragmentEnd: number            // last item index if items table
  isRepeatedHeader: boolean
  isContinued: boolean
}
```

### Section fragmentation rules

1. Non-table sections: render entirely on a single page. If they do not fit on current page, move to next page. Never split a non-table section across pages.
2. Items table section: the only section that fragments across pages. Items are placed row-by-row. When the remaining height on the current page is less than `itemRowHeight + tableHeaderHeight`, start a new page with a repeated table header.
3. Totals section: always placed on the page that immediately follows the last items table fragment. If the totals section does not fit on that page, start a new page.
4. Legal footer section: always placed at the bottom of the last page. If configured as a page footer, it appears on every page.
5. Signature section: placed after notes on the last page. If it doesn't fit, it starts a new page. Never split across pages.

### Orphan control

Minimum 3 item rows per page before a page break. If only 1 or 2 rows fit, push those rows to the next page instead. This prevents awkward single-row first pages.

### Repeated header implementation

When an items table fragment starts at any page after page 1, the table header row is rendered first (as `isRepeatedHeader: true`). The renderer checks this flag and renders the header row in the repeated-header style.

### Estimation in editor (heuristic)

The editor uses `itemRowHeight = 18px` (single-line row estimate) and `sectionHeight = sectionKey → estimated constant (e.g. header: 80px, seller_buyer: 60px, items_table: computed)`. These constants are configurable per document type in the capability schema. The page break hint is shown as a dashed line in the editor at the estimated break point.

### Exact mode (server)

The server-side exact mode works differently: render the full document as a single tall HTML page, then use Puppeteer's `page.evaluate()` to query the rendered positions of each section and calculate actual page breaks. This produces a `PageModel` that is then used to construct the final multi-page PDF.

**This is the authoritative path.** The heuristic is only for editor UX hints.

---

## 13. Validation and publish workflow plan

### Draft save (autosave)

- Triggered 1500ms after any command is applied (debounced)
- Calls `PUT /api/templates/:id/draft` with full draft content
- Updates `savedHash` in history store
- Save status chip: `Saved` | `Unsaved changes` | `Saving...`
- On page unload with unsaved changes: browser `beforeunload` warning

### Manual validation

- User clicks "Check for issues" button OR validation runs automatically before preview mode activates
- Calls `POST /api/templates/:id/validate`
- Response: `{ issues: ValidationIssue[], isValid: boolean }`
- Store: `validation.issues` updated, `validation.lastValidated` updated
- Canvas: amber badges appear on affected blocks
- Right panel: LegalStatusPanel shows issue list

### Pre-publish validation

- User clicks "Publish"
- **First**: autosave fires, waits for completion
- **Then**: full validation run (same endpoint as manual)
- If BLOCKING issues exist: modal shows issue list, Publish button disabled, "Resolve N blocking issues" message
- If WARNING issues exist: modal shows them with "Publish anyway" option
- If no issues: publish modal with changelog text field → confirm → publish

### Publish action

- `POST /api/templates/:id/publish`
- Backend: run validation again (client-side state cannot be trusted for publish gate)
- If BLOCKING issues: return 422 with issues
- If passes: create `TemplateVersion` + `TemplateVersionContent`, update `template.current_version_id`, update `template.status = 'published'`
- Frontend: receives `{ versionId, versionNumber }`, updates editor header to show "Published v{N}"

### Immutable version constraint

The `template_version_content` table has no `UPDATE` permissions granted to the application DB user. Insert-only. This is enforced at the database permission level, not just by application logic.

### Rollback flow

- User opens Version History panel
- Selects a prior version → "Set as active"
- Calls `POST /api/templates/:id/versions/:versionId/activate`
- Backend: updates `template.current_version_id` to the selected version
- No content changes. The version itself is not modified.
- New document issues will now use the activated version

---

## 14. What to postpone deliberately

| Feature | Why postpone | When to build |
|---|---|---|
| Custom computed fields / formula engine | High complexity, low immediate value. System-defined computed fields (totals) cover 100% of Phase 1 needs. | After M10, if requested by enterprise users |
| Version comparison UI (side-by-side diff) | Requires structured diff algorithm across JSONB trees. Build the "what changed" summary first. | M8 (basic summary), M10 (full diff) |
| Full multi-locale tooling (locale completeness checker, translation UI) | PL + EN covers 95% of initial users. Full locale tooling adds complexity without proportional value. | After M10 when DE or UK usage is confirmed |
| Full compliance engine (all document types) | Compliance rules for non-VAT documents (WZ, orders) have lower legal stakes. | M9 for faktura_vat rules only; M10 for others |
| KSeF submission pipeline | KSeF integration is a separate subsystem. Template bindings for KSeF fields are enough in Phase 1. | Separate initiative, post-M9 |
| Column formula builder (custom column calculations) | Standard column calculations (net × qty, etc.) are system-defined computed fields. User-defined column formulas are power-user features. | Post-M10 |
| ResizeObserver-based selection rects | Current DOM measurement approach is acceptable. ResizeObserver refactor improves performance, not correctness. | M7 or later when editor performance issues appear |
| Multi-block selection + alignment tools | Single-block editing is sufficient for all realistic template authoring tasks. | Phase 2+ when power-user demand is confirmed |
| Plugin/extension API | Block registry is the extension point. External plugin API requires versioning, SDK, documentation. | Phase 3+ |
| Collaborative editing | Single-user editor. No concurrent editing conflicts in Phase 1. | Phase 3+ |
| Free-form positioned blocks | Explicitly forbidden by architecture. Never build. | Never |

**The key insight**: These are all "nice to have" or "future requirement" features that add complexity without enabling any Phase 1 or Phase 2 use case. Building them early adds code surface that must be maintained while the core system is still stabilizing.

---

## 15. Dangerous shortcuts to forbid

### DS-1: Renderer reading Sequelize entities directly

**Why tempting**: When building the document render endpoint, it's fast to pass the loaded `Document.findOne({ include: [...] })` result directly as render input.

**Why dangerous**: Sequelize instances have circular references, lazy-loaded associations, and version-specific field names. The renderer becomes coupled to the ORM schema. Any ORM migration becomes a renderer migration.

**Correct alternative**: `RenderContextMapper` transforms the Sequelize result into a typed `DataContext` before the renderer ever sees it. The mapper owns the translation; the renderer owns the presentation.

---

### DS-2: Special-casing invoice editor

**Why tempting**: "Invoices are the most important document type. Let's make the invoice editor great first, then generalize later."

**Why dangerous**: "Later" never happens. The invoice editor accumulates invoice-specific state, invoice-specific inspector panels, invoice-specific validation calls. When WZ needs an editor, it needs a new one. This directly violates INV-7.

**Correct alternative**: Every editor feature is built capability-driven. If a feature is for invoices, it is for "documents with `hasVat: true`". If a panel is for VAT columns, it is for "items tables with `vatColumnsEnabled: true`". No document type names appear in editor component code.

---

### DS-3: Duplicating legal rules in frontend block components

**Why tempting**: A `LegalFooterBlock` component "knows" it's required, so it renders a lock icon and a tooltip. This logic is in the component.

**Why dangerous**: Legal requirements change. If the rule is in the component, updating it requires a frontend deploy. If it's in the compliance rules engine, it requires only a rules data update. Also: the frontend component may be used in a context where the legal rule does not apply (different document type), causing incorrect lock indicators.

**Correct alternative**: Block components are pure renderers. They accept `isLocked: boolean` and `legalHint: string | null` as props, resolved by the capability system. The component never decides whether it is legally required.

---

### DS-4: Separate render logic for preview and PDF

**Why tempting**: Preview needs to be fast (simple HTML), PDF needs to be perfect (complex print CSS). So write a simple renderer for preview and a full renderer for PDF.

**Why dangerous**: This is the root cause of every "preview looks different from PDF" bug report. You will spend months chasing divergence between two codepaths that model the same thing differently.

**Correct alternative**: One renderer, one stylesheet. The PDF stylesheet is the canonical stylesheet. Preview uses the same stylesheet embedded in the iframe. Minor performance differences are acceptable; behavioral differences are not.

---

### DS-5: Skipping immutable published versions

**Why tempting**: "We can add versioning later. For now, just update the template in place."

**Why dangerous**: Any document issued before versioning was added becomes un-reproducible. If a company issues 200 invoices with template v1, then edits the template, those 200 invoices now render differently if reprinted. This is an audit and legal failure.

**Correct alternative**: The version model must be in place before the first template is published for real use. It does not need a UI — the first version can be automatically created on the first publish with no changelog. But the immutable record must exist from day one.

---

### DS-6: Bypassing block registry for "quick" blocks

**Why tempting**: "This is a small helper block, I'll just add a React component without a registry entry."

**Why dangerous**: Unregistered blocks are invisible to validation, capability checks, and the compliance engine. They can be added to document types that should forbid them. They cannot be migrated during schema updates. They appear as unknown types in imported templates.

**Correct alternative**: Every block type, no matter how small, starts with a registry entry. Registry entries take 5 minutes to write. The discipline is worth it.

---

### DS-7: Storing layout as ad-hoc component state

**Why tempting**: When a user drags a section, it's easy to store the new order in local React state and "sync it to the schema later".

**Why dangerous**: Local component state is not in the command history. Undo/redo doesn't work. The state can diverge from the persisted draft. The canvas shows one thing; the save endpoint receives another.

**Correct alternative**: Every mutation goes through `applyCommand`. `applyCommand` updates the `draft` in `EditorStore`. Components are driven by `draft`, not by their own local state. No layout state lives outside the EditorStore draft.

---

### DS-8: Making `templateVersionParser` lenient for old schemas

**Why tempting**: "Old templates have schema version 1. New code expects schema version 2. Let me just add null checks everywhere so old templates don't crash."

**Why dangerous**: Null checks scattered across every service mean schema migration is implicit and untraceable. Eventually something breaks because null-check was forgotten in one place.

**Correct alternative**: `templateVersionParser` has an explicit `migrate(content, fromVersion, toVersion)` function. When loading a version with `schemaVersion: 1`, the parser migrates it to the current schema version before returning. The migration is explicit, tested, and reversible.

---

## 16. Suggested engineering ticket structure

### Group 1: Contracts (M1)

**Objective**: Define all shared TypeScript interfaces and JSON schemas before any implementation.

Sub-tasks:
- `TMPL-001` Define `TemplateVersionDraft` interface (full schema per spec)
- `TMPL-002` Define `DataContext` interface (all namespaces)
- `TMPL-003` Define `RenderContext` interface
- `TMPL-004` Define `BlockRegistryEntry` interface + JSON Schema
- `TMPL-005` Define `DocumentTypeCapabilitySchema` interface + JSON Schema
- `TMPL-006` Define `ValidationIssue` interface with severity enum
- `TMPL-007` Define `PageModel` interface
- `TMPL-008` Write `faktura_vat` capability schema JSON
- `TMPL-009` Write `oferta` capability schema JSON
- `TMPL-010` Write `zamowienie` capability schema JSON
- `TMPL-011` Write `wz` capability schema JSON

Acceptance criteria: All interfaces are in shared location importable by both client and server (or duplicated by contract). JSON schemas pass `ajv` validation. No implementation code in this group.

---

### Group 2: Backend foundation (M2)

**Objective**: DB models and core services functional via unit tests.

Sub-tasks:
- `TMPL-020` DB migrations: `templates`, `template_versions`, `template_version_content`, `template_drafts`
- `TMPL-021` Sequelize models for above tables
- `TMPL-022` `templateVersionParser.js` — JSONB → typed draft + schema migration stub
- `TMPL-023` `template.service.js` — create, get, list, update meta, archive
- `TMPL-024` `templateDraft.service.js` — save draft, get draft
- `TMPL-025` `templateVersion.service.js` — create version, get version, list versions, activate
- `TMPL-026` `documentTypeRegistry.js` — load from JSON files at startup
- `TMPL-027` `blockRegistry.js` — load from JSON files at startup
- `TMPL-028` `structuralValidator.js` — JSON Schema validation against template schema
- `TMPL-029` `bindingValidator.js` — required bindings check
- `TMPL-030` `validation.service.js` — orchestrator

Acceptance criteria: 90% line coverage on services via unit tests (Jest + Sequelize mock). `templateVersionParser` correctly round-trips a sample `faktura_vat` draft JSON.

---

### Group 3: Frontend shell (M3)

**Objective**: Editor page navigable and state-correct with placeholder canvas.

Sub-tasks:
- `TMPL-040` `EditorStore` (Zustand) — full shape, no-op actions
- `TMPL-041` `CommandBus` + `applyCommand` + history
- `TMPL-042` `useEditorSelection` hook
- `TMPL-043` `useEditorHistory` hook
- `TMPL-044` Editor page route + lazy load
- `TMPL-045` Top bar component (save status, undo/redo, locale switcher, mode toggle, publish button)
- `TMPL-046` Left panel shell (3 tabs, no content)
- `TMPL-047` Right panel shell (context-sensitive, no panels)
- `TMPL-048` Canvas placeholder (shows "Renderer goes here")
- `TMPL-049` RTK Query: template CRUD endpoints
- `TMPL-050` Autosave (debounced, 1500ms, calls draft endpoint)

Acceptance criteria: Editor page loads for a template ID. Undo/redo cycles through 3 test commands. Autosave fires and shows "Saving..." → "Saved". Locale switcher updates store. Mode toggle updates store.

---

### Group 4: Renderer (M4)

**Objective**: One shared renderer, preview API, PDF API.

Sub-tasks:
- `TMPL-060` `DocumentTemplateRenderer` — accepts `(templateDraft, dataContext, renderCtx?)`
- `TMPL-061` Render: header section
- `TMPL-062` Render: seller_buyer section
- `TMPL-063` Render: document_meta section
- `TMPL-064` Render: notes section
- `TMPL-065` Render: footer section
- `TMPL-066` `render.service.js` + `renderContextMapper.js`
- `TMPL-067` `sampleDataProvider.js` for all 4 document types
- `TMPL-068` `preview.service.js` + cache
- `TMPL-069` `pdf.service.js` (Puppeteer)
- `TMPL-070` API endpoints: `/api/templates/:id/preview`, `/api/render/document`, `/api/documents/:id/pdf`
- `TMPL-071` Visual regression test: render sample faktura_vat, compare HTML vs PDF screenshot

Acceptance criteria: Preview API returns valid HTML. PDF for a 1-page sample faktura_vat (no items) passes visual review. Server and client produce identical HTML for same inputs (verified by snapshot test).

---

### Group 5: First blocks (M5 part 1)

**Objective**: 12 Phase 1 blocks registered, rendered, and editable.

Sub-tasks:
- `TMPL-080` Block registry JSON entries for all 12 Phase 1 blocks
- `TMPL-081–091` One ticket per block: `DocumentTitleBlock`, `DocumentNumberBlock`, `DocumentDatesBlock`, `CompanyLogoBlock`, `CompanyIdentityBlock`, `CounterpartyIdentityBlock`, `ItemsTableBlock` (single-page), `TotalsTableBlock`, `PaymentBlock`, `NotesBlock`, `LegalFooterBlock`
- `TMPL-092` Block library UI tab — shows registered blocks grouped by category, draggable
- `TMPL-093` Block list renders on canvas via renderer

Acceptance criteria: All 12 blocks render correctly in preview HTML. Block library UI shows all 12 blocks in correct groups. Dragging a block from library panel adds it to the canvas (via command).

---

### Group 6: First document types (M5 part 2)

**Objective**: `faktura_vat` and `oferta` fully functional end-to-end.

Sub-tasks:
- `TMPL-100` Inspector panels: all section + block types
- `TMPL-101` Binding picker UI (search, tree, sample value, insert token chip)
- `TMPL-102` Token chips in text blocks (render, click to edit, delete)
- `TMPL-103` Publish flow (frontend modal, validation display)
- `TMPL-104` System default templates for `faktura_vat` and `oferta` (JSON)
- `TMPL-105` Canvas: section selection, block selection (clicks)
- `TMPL-106` Legal footer: locked block indicator, lock override with warning
- `TMPL-107` Pre-publish validation modal: BLOCKING/WARNING/INFO grouped, navigate to issue

Acceptance criteria: Full E2E test: load default faktura_vat template, customize brand color, preview with sample data (5 items), publish, download PDF. PDF passes visual review. Attempting to publish with `company.nip` unbound shows blocking error.

---

### Group 7: Governance (M8)

**Objective**: Version history, rollback, company overrides.

Sub-tasks:
- `TMPL-130` Version history panel UI
- `TMPL-131` Rollback action + API endpoint
- `TMPL-132` Version comparison: basic "what changed" summary
- `TMPL-133` Company override flow (duplicate system template)
- `TMPL-134` System template update notification

---

### Group 8: Compliance (M9)

**Objective**: Legal compliance enforced in validation.

Sub-tasks:
- `TMPL-140` `complianceValidator.js` with rule engine
- `TMPL-141` `PL_VAT_2024.json` rule set
- `TMPL-142` Canvas warning indicators (amber badges)
- `TMPL-143` LegalStatusPanel in right panel
- `TMPL-144` Polish-market field hints in binding picker
- `TMPL-145` KSeF reference block + QR block
- `TMPL-146` KSeF readiness indicator (advisory)

---

## 17. Fastest path to production-grade foundation

### What must be built first (cannot mock)

1. **Template schema contract** — every service depends on it. Cannot mock.
2. **Immutable version model** — must be in place before first real publish. Cannot mock.
3. **Renderer as pure function** — if renderer has side effects from day one, untangling them is a multi-sprint refactor. Cannot mock.
4. **Block registry** — must gate block usage in renderer and validator from day one. Cannot mock.

### What can be mocked temporarily

| Component | Mock | Until |
|---|---|---|
| PageCalculator exact mode | Single-page only (no overflow) | M6 |
| Compliance rules engine | No compliance validation — just structural check | M9 |
| Binding picker | Flat list with no search, no sample values | M5 (replace with full picker) |
| Version comparison | No comparison UI — just version list | M8 |
| PDF visual regression tests | Manual review only | M4 (automate then) |
| Multi-locale tooling | PL only, no locale completeness check | M10 |

### When the system becomes safe to onboard real company templates

**Prerequisites before onboarding any company template**:
1. ✓ Immutable version model in place (no accidental mutation of published versions)
2. ✓ `faktura_vat` fully functional end-to-end including PDF
3. ✓ Required bindings validation runs and blocks publish on BLOCKING issues
4. ✓ Draft autosave is stable (no data loss on connection drop)
5. ✓ Preview HTML matches PDF output for standard faktura_vat with 1–50 items (visual reviewed)
6. ✓ Template CRUD has proper company_id isolation (no cross-company template access)

All 6 prerequisites are achievable by end of M5.

---

## 18. Final recommendation

### Recommended implementation sequence

```
M1 (2 weeks) → M2 (2 weeks) → M3 (2 weeks) → M4 (3 weeks)
  → M5 (4 weeks) → M6 (3 weeks) → M7 (3 weeks)
    → M8 (2 weeks) → M9 (2 weeks) → M10 (3 weeks)
```

Total: ~26 weeks to M10 with one engineer or ~14 weeks with two parallel tracks (backend M1-M2-M4 + frontend M3-shell during M4).

### Recommended first release scope

**"Phase 1 release" = M5 complete + M6 items table paging**:
- Templates: `faktura_vat`, `oferta`, `zamowienie`, `wz`
- Editor: section reorder, block add/remove, binding picker, basic field properties, preview mode, print preview
- PDF: download from document detail page
- Governance: draft/publish model, basic version list
- Compliance: required bindings check (no full legal rules engine yet)
- Locales: PL + EN

This is a production-grade, architecturally sound system. Not complete, but extensible without rework.

### Recommended architecture guardrails

Enforce these mechanically, not through convention:

1. **Renderer has no imports from editor store**: Lint rule — `DocumentTemplateRenderer.jsx` and `*.Block.jsx` files may not import from `store/`.
2. **No `documentType ===` conditions in editor components**: ESLint custom rule flagging string comparisons against document type keys in `src/pages/company/CompanySettings/Modules/DocumentTemplateEditorPage/`.
3. **Block registry is the only way to register a block**: Any `blockType:` string used in a template schema must exist in BlockRegistry. Verified by `validation.service` structuralValidator.
4. **Template version content is insert-only**: DB user `app_user` has no `UPDATE` permission on `template_version_content`. Enforced at DB level.
5. **`renderContextMapper` is the only path from Sequelize entities to DataContext**: Grep CI check — no direct Sequelize model imports in any file within `services/documents/render/`.

### Definition of "Phase 1 done"

- A company admin can create a `faktura_vat` template from scratch or from default, customize it, and publish it
- An operator can issue a document using that template and download a legally-formatted PDF
- The PDF matches the canvas preview for documents with 1–50 line items
- Template changes after publish create a new version, not in-place modification
- Required legal bindings (NIP, dates, number) cannot be missing on a published `faktura_vat` template
- The same editor, without any code changes, creates a `wz` template with warehouse columns and no price data
- All data displayed in the PDF is resolved from live data, not static template text

### Definition of "safe to scale"

The system is safe to scale when:
1. A new document type can be added by creating 2 JSON files (capability schema + system default template) with zero code changes
2. A new block type can be added by creating 1 registry entry + 1 renderer component with no changes to the editor shell, inspector, or validation service
3. The compliance rules for a document type can be updated (due to legal change) by updating a JSON rules file with no deploy required
4. Rendering the same `templateVersionId` produces byte-identical PDF output regardless of when it is rendered
5. Two engineers can work simultaneously on different document type implementations without merge conflicts in shared infrastructure files

---

*End of implementation plan. This document is the authoritative engineering reference for phased execution. Deviations from canonical invariants (Section 2) and forbidden shortcuts (Section 15) require explicit architectural review before proceeding.*
