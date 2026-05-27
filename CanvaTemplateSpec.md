# Document Template Canvas Builder — Product & Architecture Specification

**Version 1.0 | April 2026 | For internal product/engineering use**

> **Status:** Canonical architecture draft for product/design/engineering alignment
>
> **Purpose of this document:**
> - define the long-term target architecture for the document template platform
> - establish canonical contracts before implementation begins
> - separate foundational decisions from phased delivery planning
>
> **Non-goal:** this document does not force full feature delivery in one milestone. It defines the ideal target state and the contracts that early implementation must preserve.

---

## A. PRODUCT VISION

### What an ideal document template canvas builder for modern ERP/CRM is

It is a **structured document authoring system** — not a generic design tool, not a word processor, not a PDF form editor. Its job is to let businesses define how their documents look and what data they contain, once, and have the system produce correct, beautiful, legally-sound output across every channel and every scenario automatically.

The distinction matters: it is an **ERP-native document production system** with a canvas UX, not a design canvas that happens to handle ERP data.

### The real problem it solves

Businesses in Poland produce dozens of document types daily. Each document must:
- Meet legal requirements (NIP, VAT rate breakdowns, KSeF-readiness, mandatory fields by document type)
- Carry company branding consistently
- Adapt to counterparty context (language, format, legal entity type)
- Be issued across multiple channels (print, PDF, email, system export, archive)
- Be maintainable — when your NIP changes, it changes everywhere, not in 40 separate templates

Existing solutions force businesses to choose between **legal compliance** (rigid pre-built templates they can't change) or **visual control** (Word/Canva exports they can't bind to live data). Neither is acceptable for a serious ERP.

### Why existing editors are bad

| Problem | Root cause |
|---|---|
| Hard to use for non-designers | Built on free-form canvas metaphor (Figma-like) without document structure |
| Break on multi-page content | Designed for single-page marketing, not variable-length business documents |
| No data awareness | Fields are static text labels, not live bindings to business objects |
| No legal awareness | No concept of "this field is required by Polish VAT law" |
| Fragile on print | Screen layout ≠ print layout; margin, bleed, page-break rules ignored |
| Template maintenance nightmare | No versioning, no company override, no schema migration |
| One-document-type focus | Built for "invoices only" then hacked to cover other types |
| Ugly output despite pretty editor | Rendered HTML/PDF doesn't match what editor showed |

### Product principles

1. **Structure over freedom.** The document has zones and rules. Freedom is within zones, not against them.
2. **Data-first, design-second.** Every field is a binding. Design wraps data. Not the reverse.
3. **Compliance as infrastructure.** Legal requirements are not a checklist — they're part of the schema engine.
4. **One architecture, all documents.** No separate editor per document type. Capability flags + section registry.
5. **WYSIWYG means print-accurate.** The canvas must show exactly what will come out of the printer/PDF renderer.
6. **Speed at scale.** Issuing 50 invoices a day means the template must just work. Editor is rarely opened.
7. **Versioned and auditable.** Template changes must be traceable. Published templates are immutable snapshots.
8. **Progressive complexity.** Accounting operator → power user → developer — each gets the complexity they need.

---

## B. DOCUMENT DOMAIN MODEL

### Core entity map

```
DocumentFamily
  └── DocumentType (capability set)
        └── Template (schema + style)
              └── TemplateVersion (immutable snapshot)
                    ├── BlockTree
                    │     ├── Section[]
                    │     │     └── Block[]
                    │     │           ├── Token/Placeholder[]
                    │     │           ├── ComputedField[]
                    │     │           ├── ConditionalRule[]
                    │     │           └── LayoutConfig
                    ├── StyleTokenSet
                    ├── DataBindingMap
                    ├── LocaleVariant[]
                    ├── PrintSettings
                    ├── LegalConstraintSet
                    └── NumberingPreset
```

### Canonical architecture stance

This specification is intentionally **architecture-first**.

The template system must NEVER depend on raw ORM structures (Sequelize models, includes, nested relations).

Instead, ALL documents must be transformed into a canonical **RenderContext**.

Rules:
- Renderer consumes ONLY RenderContext
- Editor consumes ONLY schema + bindings
- Backend models can change without breaking templates
- New document types must plug into existing system without refactor

This is the single most important invariant of the system.

### Entity definitions

**DocumentFamily**
A logical grouping of related document types. Examples: `sales`, `warehouse`, `accounting`, `logistics`, `internal`. Defines the base capability set all members inherit. Not user-visible directly — used by system for default block sets and validation rules.

**DocumentType**
A specific document class within a family. Examples: `faktura_vat`, `wz`, `proforma`, `zamowienie`. Carries:
- Required sections (cannot be removed)
- Forbidden sections (cannot be added)
- Recommended sections (shown by default)
- Legal field constraints (required by law)
- KSeF-readiness flag
- Default numbering schema
- Allowed render channels

**Template**
A company-level named configuration for producing a DocumentType. One DocumentType can have multiple Templates (e.g. "Standard Invoice", "Export Invoice EN/DE", "Proforma for Sales Team"). A Template has:
- A DocumentType reference
- A name + description
- An active TemplateVersion
- Status: `draft | published | archived`
- Scope: `system_default | company_default | custom`
- Owner: system | company | user

**TemplateVersion**
An immutable, numbered snapshot of a Template. Produced on every publish action. Contains the full serialized block tree, style tokens, bindings, locale variants, print settings. Once published, a version never changes. Document renders always reference a specific TemplateVersion by ID to ensure reproducibility.

**BlockTree**
Hierarchical content model. Root is `DocumentCanvas`. Children are `Section[]`. Each Section contains `Block[]`. Blocks are atomic content units. This is the editor model.

**Section**
A named top-level zone in a document canvas. Examples: `header`, `seller_buyer`, `document_meta`, `items_table`, `totals`, `payment`, `notes`, `footer`. Sections have:
- Order (sortable)
- Visibility rules
- Layout mode: `flow | grid | fixed`
- Enabled/disabled
- Locked (system sections user can't remove)
- Page-break behavior

**Block**
An atomic, typed content unit inside a Section. Has a `blockType` (from BlockRegistry), layout configuration (width, alignment, padding), style overrides, and a content model (see Block Library). Examples: `CompanyLogoBlock`, `AddressBlock`, `ItemsTableBlock`, `SignatureBlock`.

**Token / Placeholder**
A reference to a runtime data value within a Block's text content. Syntax: `{{company.name}}`, `{{document.number}}`, `{{counterparty.nip}}`. Resolved at render time from the DataBindingContext.

**DataBinding**
A mapping from a Token path to a data source and optional formatter. Example: `{ path: "document.issueDate", source: "document", formatter: "date.PL" }`. Stored per-template, validated against DataSchema at publish time.

**ComputedField**
A field whose value is derived at render time from other bindings using an expression. Example: `totals.vatAmount = sum(items[*].vatAmount)`. Computed fields are read-only in the editor — their output is shown as a preview chip.

**LegalRequiredField**
A binding path tagged as legally required for a given DocumentType under Polish law. The system knows, for example, that `document.sellerNip` is required on `faktura_vat`. These constraints are part of the DocumentType capability schema, not the template — so they apply regardless of template.

**ConditionalField / VisibilityRule**
A rule that shows/hides a block or section based on a condition. Example: `{ show: "payment.deferredPayment > 0", block: "payment_terms_block" }`. Evaluated at render time.

**PrintRule**
Configuration for physical output: page size (A4), margins, bleed, safe zone, page-break behavior, header/footer repeat, orphan/widow control, color profile.

**LocaleVariant**
A language layer on top of a template. Labels, static text, date/number formats, legal footer text — all defined per locale. Binding paths are locale-independent; only display labels change. Supported: `pl`, `en`, `de`, `uk`.

**NumberingPreset**
A named rule for generating document numbers. Examples: `FV/{YYYY}/{MM}/{NNN}`, `WZ/{YYYY}/{NNN}`. Stored separately from template, assigned per document type + company.

**LayoutPreset**
A named combination of font, color scheme, margin, spacing — applied to a template as a starting point. Examples: `minimal_clean`, `classic_corporate`, `modern_premium`.

**RenderMode**
How the template is being rendered. Values: `editor_preview`, `screen_view`, `print`, `pdf`, `email_html`, `system_export`. Each mode can activate/deactivate blocks (e.g. QR code only in print mode, email disclaimer only in email mode).

**ChannelMode**
The output channel. Determines which blocks are active, which formatting rules apply, which assets are inlined.

**Template Status**
`draft` → editable, not used for document issue
`published` → used for document issue, snapshot frozen
`archived` → no longer active, retained for historical renders

**System default vs company override**
System provides factory templates for each DocumentType. A company can override by duplicating and customizing. If the company has no custom template for a type, the system default is used. Company admins can set a company default among their custom templates.

---

## C. TEMPLATE SYSTEM ARCHITECTURE

### Storage model

```json
{
  "templateVersionId": "uuid",
  "documentTypeKey": "faktura_vat",
  "schemaVersion": "3",
  "meta": {
    "name": "Standard Faktura VAT",
    "locale": "pl",
    "localeVariants": ["pl", "en"]
  },
  "canvas": {
    "pageSize": "A4",
    "orientation": "portrait",
    "margins": { "top": 20, "right": 15, "bottom": 20, "left": 15 },
    "sections": [
      {
        "key": "header",
        "type": "header",
        "order": 0,
        "enabled": true,
        "locked": false,
        "layoutMode": "flex_row",
        "fields": []
      }
    ]
  },
  "styleTokens": {
    "colorPrimary": "#1a2744",
    "colorAccent": "#2563eb",
    "fontFamily": "Inter",
    "fontSizeBase": 9,
    "fontSizeSmall": 7.5,
    "fontSizeLarge": 14,
    "borderColor": "#e2e8f0",
    "tableHeaderBg": "#f8fafc"
  },
  "dataBindings": {
    "company.name": { "source": "company", "path": "name", "format": null },
    "document.number": { "source": "document", "path": "number", "format": null },
    "document.issueDate": { "source": "document", "path": "issueDate", "format": "date.PL" }
  },
  "localization": {
    "pl": { "label.seller": "Sprzedawca", "label.buyer": "Nabywca" },
    "en": { "label.seller": "Seller", "label.buyer": "Buyer" }
  },
  "visibilityRules": [
    { "blockKey": "payment_terms", "condition": "document.paymentDays > 0" }
  ],
  "printSettings": {
    "headerRepeat": true,
    "tableHeaderRepeat": true,
    "pageBreakBefore": ["items_table"],
    "orphanControl": true
  },
  "legalConstraints": {
    "inherited": true,
    "documentTypeKey": "faktura_vat",
    "overrides": []
  },
  "numberingPresetKey": "FV_STANDARD",
  "layoutPresetKey": "classic_corporate"
}
```

### Schema separation: editor model vs render model

**Editor model** (what the editor stores and manipulates):
- Block tree with designer-friendly IDs
- Style tokens as named variables
- Bindings as symbolic paths
- Visibility rules as expressions
- Locale text as keyed strings

**Render model** (what the renderer consumes — compiled from editor model):
- Flat, ordered section/block list with resolved styles
- Bindings resolved against DataContext
- Visibility rules evaluated
- Locale variant applied
- Page split points calculated
- Print/channel overrides applied

**Compile pipeline:**
```
TemplateVersion → SchemaValidator → BindingResolver → VisibilityEvaluator
  → LocaleApplicator → StyleTokenExpander → PageCalculator → RenderModel
```

**Validation pipeline (on publish):**
```
BlockTree → RequiredFieldsCheck → LegalConstraintsCheck
  → BindingPathCheck → LocaleVariantCompleteness → PrintSettingsCheck → PublishGate
```

**Preview pipeline:**
```
EditorDraft → FastCompile (skip heavy checks) → SampleDataInjector → PageRenderer → PreviewOutput
```

**Export pipeline:**
```
DocumentRecord + TemplateVersionSnapshot → FullCompile → DataResolver
  → ChannelAdapter (print|pdf|email|export) → OutputRenderer → File/Stream
```

### Schema registry
### Block registry contract

Every block type must be declared centrally.

```ts
interface BlockRegistryEntry {
  type: string;
  displayName: string;
  family: string;
  allowedDocumentTypes?: string[];
  forbiddenDocumentTypes?: string[];

  defaultProps: Record<string, any>;

  layout: {
    widthMode: 'auto' | 'fraction' | 'fixed';
    widthValue?: number;
    minWidthPx?: number;
  };

  bindingSchema?: {
    supportedPaths: string[];
    requiredPaths?: string[];
  };

  renderBehavior: {
    supportsPrint: boolean;
    supportsPdf: boolean;
    supportsPreview: boolean;
  };
}
```

Rules:
- Renderer must be pure
- No block logic inside components
- Validation comes from registry
- Inspector UI is generated from registry

A server-side registry maps `documentTypeKey` → `DocumentTypeCapabilitySchema`. This schema defines:
- Required section keys
- Forbidden section keys
- Required binding paths
- Legal constraint rule set
- Default block configuration
- Allowed column sets for item tables

This registry is the single source of truth for compliance. Templates never duplicate it — they inherit it.

---

## D. SUPPORTED DOCUMENT TYPES STRATEGY

### Classification

**Sales documents**

| Type | Key | Notes |
|---|---|---|
| Faktura VAT | `faktura_vat` | Core. KSeF-relevant. Full VAT breakdown required |
| Faktura zaliczkowa | `faktura_zaliczkowa` | Links to order. Partial amounts. Specific required fields |
| Faktura końcowa | `faktura_koncowa` | References prior advance invoices |
| Faktura korygująca | `faktura_korygujaca` | References original invoice. Shows delta |
| Proforma | `proforma` | Non-tax document. Simpler legal requirements |
| Oferta handlowa | `oferta` | No VAT required. Validity date field. Optional terms |
| Potwierdzenie zamówienia | `potwierdzenie_zamowienia` | Order reference. Delivery block |

Common layout patterns: company block top, counterparty block, document meta, items table, totals, payment, notes, footer.
Unique per type: correction reference block, advance invoice links block, validity/expiry block.

**Warehouse documents**

| Type | Key | Notes |
|---|---|---|
| WZ (Wydanie zewnętrzne) | `wz` | Outgoing goods. Receiver signature block |
| PZ (Przyjęcie zewnętrzne) | `pz` | Incoming goods. Supplier reference block |
| MM (Przesunięcie magazynowe) | `mm` | Internal transfer. Two warehouse blocks |
| RW (Rozchód wewnętrzny) | `rw` | Internal consumption. Cost center block |
| PW (Przyjęcie wewnętrzne) | `pw` | Internal receipt. Production/source block |

Common layout patterns: warehouse header, movement type, item list (no price for some types), warehouse signature block, driver/carrier block.
Unique per type: source/destination warehouse, reason, cost center, linked order reference.

**Accounting / Tax documents**

| Type | Key | Notes |
|---|---|---|
| Paragon fiskalny | `paragon` | Simplified. Fiscal printer output reference |
| Nota korygująca | `nota_korygujaca` | Non-VAT correction. Specific legal text required |
| Nota księgowa | `nota_ksiegowa` | Internal settlement |

**Order / Commercial documents**

| Type | Key | Notes |
|---|---|---|
| Zamówienie (zakupowe) | `zamowienie_zakupowe` | Supplier-facing. Delivery address prominent |
| Zamówienie (sprzedażowe) | `zamowienie_sprzedazowe` | Customer-facing |
| Oferta | `oferta` | Validity block, optional signature block |

**Logistics / Delivery**

| Type | Key | Notes |
|---|---|---|
| List przewozowy | `list_przewozowy` | Carrier blocks, weight/dimensions |
| Potwierdzenie odbioru | `potwierdzenie_odbioru` | Delivery confirmation, signature |

### Capability flag system

Each DocumentType carries a capability flag set:

```json
{
  "hasVat": true,
  "hasKSeFFields": true,
  "hasPaymentBlock": true,
  "hasItemTable": true,
  "itemTablePriceVisible": true,
  "hasWarehouseBlock": false,
  "hasSignatureBlock": false,
  "hasCarrierBlock": false,
  "hasCorrectionReference": false,
  "hasAdvanceReference": false,
  "isLegalDocument": true,
  "requiresSellerNip": true,
  "requiresBuyerNip": false,
  "requiresLegalFooter": true,
  "allowedLocales": ["pl", "en", "de"],
  "defaultLocale": "pl"
}
```

The block library checks `capabilities` before offering blocks. The validation pipeline checks `legalConstraints` before allowing publish. The canvas hides/shows sections based on capability flags.

### Inheritance model

```
BaseDocumentTemplate (abstract)
  ├── SalesDocumentTemplate
  │     ├── InvoiceTemplate (faktura_vat, zaliczkowa, końcowa, korygująca)
  │     ├── ProformaTemplate
  │     └── OfferTemplate
  ├── WarehouseDocumentTemplate
  │     ├── OutgoingGoodsTemplate (wz)
  │     ├── IncomingGoodsTemplate (pz)
  │     └── InternalMovementTemplate (mm, rw, pw)
  └── AccountingDocumentTemplate
```

---

## E. CANVAS UX CONCEPT

### Screen layout
### Editor state machine

| State | Description |
|------|------------|
| idle | nothing selected |
| selecting | element selected |
| dragging | dragging section/block |
| resizing | resizing block |
| editing | inline text editing |
| binding | binding picker active |
| preview | preview mode |
| print | print preview |

Rules:
- Only ONE active state at a time
- No overlapping interactions
- All transitions must be deterministic

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP BAR                                                        │
│  [←Back] [Template Name ▾] [Saved] [Undo][Redo] [Locale▾]     │
│  [Preview] [Publish]                                            │
├────────────┬────────────────────────────────┬───────────────────┤
│ LEFT PANEL │         CANVAS                 │  RIGHT PANEL      │
│            │                                │                   │
│ Sections   │  ┌──────── A4 page ─────────┐  │  Block            │
│ Blocks     │  │  [Header]                │  │  Properties       │
│ Bindings   │  │  [Seller / Buyer]        │  │                   │
│ Data       │  │  [Document Meta]         │  │  ─────────────    │
│            │  │  [Items Table]           │  │  Style            │
│            │  │  [Totals]                │  │  Overrides        │
│            │  │  [Payment]               │  │                   │
│            │  │  [Notes]                 │  │  ─────────────    │
│            │  │  [Footer]                │  │  Bindings         │
│            │  └──────────────────────────┘  │                   │
│            │  Page 1 of 1                   │  ─────────────    │
└────────────┴────────────────────────────────┴  Legal Status     │
                                                 └────────────────┘
```

### Left panel — three tabs

**Sections tab**
- Ordered list of all sections in the current document
- Each section: name, enabled toggle, lock icon, drag handle for reorder
- Add section button — opens block library filtered by document type capability
- Sections not allowed for this document type are greyed with tooltip
- Required sections are locked (cannot disable)

**Blocks tab (add blocks)**
- Grouped block library: Identity, Counterparty, Document Meta, Table, Totals, Payment, Warehouse, Signatures, Legal, Other
- Search input at top
- Blocks unavailable for this document type shown dimmed with reason
- Drag to canvas OR click to insert into selected section

**Data tab**
- Binding path browser: tree view of all available data paths
- `company.*`, `counterparty.*`, `document.*`, `items[*].*`, `totals.*`, `payment.*`
- Search by path
- Click to copy binding token `{{path}}`
- Shows sample value next to each path
- Missing/unbound paths highlighted

### Top bar

- Template name (editable inline, click to rename)
- Save status chip: `Saved` / `Unsaved changes` / `Saving...`
- Undo / Redo (Cmd+Z / Cmd+Shift+Z)
- Locale switcher: `PL | EN | DE` — switches canvas to show that locale's text
- Zoom: `50% | 75% | 100% | Fit` — keyboard: Cmd+= / Cmd+-
- Mode toggle: `Edit | Preview | Print preview`
- **Publish button**: primary action, opens validation summary before confirming

### Right panel — context-sensitive

When nothing selected: **Document settings** (page size, orientation, margins, numbering preset, theme)

When section selected: **Section settings** (layout mode, spacing, background, border, visibility rule, section-level style)

When block selected: **Block properties** (block-type-specific config) + **Style** (font, color, padding, alignment) + **Binding** (assigned token, fallback value) + **Conditions** (visibility rule)

When field (inside block) selected: **Field properties** (font size, width, enabled, label override)

### Canvas

The canvas is always A4-constrained. Users cannot place content outside the page boundary. Margins are rendered as a faded overlay on the canvas, not hidden.

**Page indicator**: "Page 1 / 3 (estimated)" shown below canvas in preview. In edit mode, single conceptual page with a visual cue showing approximately where page breaks will occur.

**Section cards**: Each section renders as a visual card with a top-bar showing section name, enable toggle, lock icon, and drag handle. The section card is the primary editing unit.

**Selected section**: Blue border on the card. Right panel shows section properties.

**Selected field/block**: Subtle inner highlight. Right panel shows block/field properties. Keyboard: Tab to cycle between blocks within a section.

**Drag and drop rules**:
- Sections: drag to reorder (top-level vertical reorder only)
- Blocks within a section: drag to reorder within section, or drag to different section
- Blocks from left panel: drag onto canvas to insert into specific section (drop zones appear on hover)
- No free positioning — everything is flow-based within sections

**Smart snapping**: When resizing block width, snap to common fractions: 1/2, 1/3, 2/3, 1/4, 3/4 of section width. Visual snap line appears.

**Rulers**: Optional. Show/hide with `Cmd+Shift+R`. Millimeter ruler along top and left. Grid: 5mm.

**Margin overlay**: Always shown as a subtle inset line. Non-interactive.

**Page-break indicator**: Dashed line with "Page break" label. Shown in preview mode. In edit mode, shown as a subtle hint line after sections configured as page-break-before.

### Interaction model

| Input | Action |
|---|---|
| Click | Select section or block |
| Double-click | Enter inline text editing (text blocks) |
| Click outside | Deselect |
| Drag section handle | Reorder sections |
| Drag block | Reorder or move to another section |
| Cmd+Z / Cmd+Shift+Z | Undo / Redo |
| Delete | Remove selected block |
| Tab / Shift+Tab | Cycle selection between blocks |
| Escape | Deselect / exit inline editing |
| Cmd+D | Duplicate selected block |
| Cmd+] / Cmd+[ | Move block forward/backward in section |

### Edit mode vs Preview mode vs Print preview mode

**Edit mode**: Section cards visible, drag handles visible, selection borders visible. Canvas background is dark workspace, document white page centered.

**Preview mode**: Section cards hidden, drag handles hidden. Document looks exactly as it will print. Sample data injected (toggle: sample data vs empty). Side panels collapse to minimal strip.

**Print preview mode**: Full multi-page spread. Each page rendered as a separate white A4 sheet. Matches PDF output exactly. No editing possible.

### Onboarding and empty state

When a user navigates to Templates for the first time: a modal guide with 3 steps — "Choose document type", "Pick a starting template", "Customize". No blank canvas ever presented as a first experience.

When creating a new template:
1. Modal: Select document type (grouped, with icons and descriptions)
2. Modal: Choose starting point — "Start from best practice" (recommended), "Start minimal", or "Start from existing template"
3. Editor opens with the chosen starting state, annotated with blue helper chips explaining what each section does

**"Start from best practice"**: Opens with the system default template for that document type — fully populated with canonical sections, best-practice layout, sample data shown. User just customizes.

**Locale switcher in editor**: PL/EN/DE buttons in top bar. Switching shows that locale's text labels on the canvas. Does not switch data — data bindings are locale-independent. Shows a warning if that locale has untranslated labels.

### Legal/required field indicators

**On the canvas**: Blocks with legally required bindings show a small amber `⚠ Required by law` chip if the binding is empty or missing.

**In the left panel**: Sections that contain required fields show a dot indicator if any required field is unbound.

**Before publish**: Validation summary lists all unbound required fields, missing locale variants, and legal warnings. Publish is blocked until critical issues are resolved.

**Data-bound blocks**: Show a small blue `⟨ ⟩` chip in the top-right corner of the block when in edit mode. Hovering shows the binding path and current sample value.

---

## F. BLOCK LIBRARY

### Identity / Company blocks

**CompanyLogoBlock**
- Purpose: Display company logo
- When used: Header of all documents
- Editable props: Width, height, alignment, object-fit
- Binding: `company.logoUrl`
- Print behavior: Inline image, exact dimensions
- Constraints: Locked if system-provided logo; cannot have text bindings
- Overflow: Clip to specified dimensions

**CompanyNameBlock**
- Purpose: Company legal name and optional tagline
- Binding: `company.legalName`, `company.displayName`
- Localization: Locale-independent (legal name always in company's registered language)

**CompanyAddressBlock**
- Purpose: Registered address, correspondence address
- Binding: `company.addressLine1`, `company.city`, `company.postalCode`, `company.country`
- Props: Address format (PL format, EU format, single-line, multi-line)
- Print behavior: Multi-line text block

**CompanyIdentifiersBlock**
- Purpose: NIP, REGON, KRS, BDO, bank account
- Binding: `company.nip`, `company.regon`, `company.krs`, `company.bankAccount`
- Props: Which identifiers to show, label override, layout (inline or stacked)
- Legal: NIP required on `faktura_vat`; warning if hidden

### Counterparty / Customer blocks

**CounterpartyNameBlock**
- Binding: `counterparty.legalName`, `counterparty.displayName`
- Props: Label (Nabywca / Odbiorca / Kupujący / custom)

**CounterpartyAddressBlock**
- Binding: `counterparty.addressLine1` etc.
- Props: Format selection

**CounterpartyIdentifiersBlock**
- Binding: `counterparty.nip`, `counterparty.regon`
- Props: Show/hide per identifier; required flag display
- Note: Buyer NIP optional on B2C documents; required on B2B VAT invoices

**DeliveryAddressBlock**
- Binding: `counterparty.deliveryAddress.*`
- Visibility rule: `counterparty.deliveryAddress != counterparty.billingAddress`

### Document Meta blocks

**DocumentTitleBlock**
- Purpose: Large document type label ("FAKTURA VAT", "PROFORMA", "WZ")
- Binding: `documentType.displayName` (resolved via locale)
- Props: Font size, alignment, uppercase toggle
- Note: Changing document type label requires caution — legal documents have specific required titles

**DocumentNumberBlock**
- Binding: `document.number`
- Props: Label ("Numer:", "Nr:"), format hint display

**DocumentDatesBlock**
- Binding: `document.issueDate`, `document.saleDate`, `document.dueDate`
- Props: Which dates to show, label overrides, date format
- Legal: Issue date and sale date required on `faktura_vat`

**CurrencyBlock**
- Binding: `document.currency`, `document.exchangeRate`
- Visibility rule: `document.currency != "PLN"` for exchange rate display

### Payment blocks

**PaymentMethodBlock**
- Binding: `payment.method`, `payment.bankAccount`, `payment.dueDate`
- Props: Show/hide bank account, payment method label mapping

**PaymentDueBlock**
- Binding: `payment.dueDate`, `payment.daysNet`
- Props: Label, date format

**PaymentQRBlock**
- Purpose: QR code for payment (Polish BLIK/bank transfer QR standard)
- Binding: `payment.qrPayload` (computed from account + amount)
- Print behavior: Vector or high-res raster, minimum 2cm × 2cm
- Channel: Print and PDF only; hidden in email

### Item Table blocks

See section G — dedicated deep design.

### Totals / Tax blocks

**TotalsTableBlock**
- Purpose: Net / VAT / Gross breakdown by VAT rate
- Binding: `totals.byVatRate[]`, `totals.net`, `totals.vat`, `totals.gross`
- Props: Show/hide VAT rate rows, currency display, rounding display
- Legal: VAT breakdown required on `faktura_vat`
- Layout: Right-aligned table, typically 60% width from right

**AmountInWordsBlock**
- Purpose: "Słownie: dwieście pięćdziesiąt złotych" — legally required in some contexts
- Binding: `totals.gross` → formatter `amountInWords.PL`
- Props: Language (PL/EN), prefix label
- Localization: Locale-specific formatter required per language

**TaxSummaryBlock**
- Binding: `taxes.*`
- Props: Display mode (table vs inline), rate labels

### Signature / Stamp blocks

**SignatureBlock**
- Purpose: Hand-drawn or e-signature placeholder with role label
- Binding: `signatures.issuer`, `signatures.receiver`, optional
- Props: Width, label ("Wystawił:", "Odebrał:"), show/hide signature line, show/hide date line
- Channel: Print only (hidden in email mode unless e-signature attached)

**StampBlock**
- Purpose: Company stamp placeholder
- Props: Placeholder shape (circle/square), label, size
- Channel: Print-facing hint — not rendered in digital-only modes unless image provided

### Notes / Terms blocks

**NotesBlock**
- Binding: `document.notes`
- Props: Label, max height behavior (expand vs truncate)

**PaymentTermsBlock**
- Binding: `document.paymentTerms`
- Visibility rule: `document.paymentTermsText != null`

**LegalFooterBlock**
- Purpose: Mandatory legal text (e.g. "Faktura nie wymaga podpisu" or KSeF reference)
- Binding: Partially static text, partially `document.ksefNumber`
- Legal: Required text changes per document type
- Constraints: Content not freely editable — system provides locale-aware legal text; user can append but not replace

### Warehouse / Logistics blocks

**WarehouseBlock**
- Purpose: Source/destination warehouse
- Binding: `warehouse.source.*`, `warehouse.destination.*`
- When: `wz`, `pz`, `mm`, `rw`, `pw`

**CarrierBlock**
- Purpose: Carrier/driver information
- Binding: `shipment.carrier`, `shipment.vehiclePlate`, `shipment.driverName`
- When: `wz`, `list_przewozowy`

**GoodsReceiptBlock**
- Purpose: "Towar odebrałem" confirmation with date and signature line
- When: `wz`, `pz`

### KSeF / e-invoice blocks

**KSeFReferenceBlock**
- Purpose: Display KSeF number once registered
- Binding: `document.ksefNumber`, `document.ksefDate`
- Visibility rule: `document.ksefNumber != null`
- Legal: Required display if KSeF number exists

**KSeFQRBlock**
- Purpose: KSeF verification QR code
- Binding: `document.ksefVerificationUrl`
- Channel: Print and PDF

### QR / Barcode blocks

**BarcodeBlock**
- Binding: `document.number` or custom binding
- Props: Type (EAN13, Code128, QR), size, label display

---

## G. TABLE / LINE ITEMS UX

### Architecture

The items table is the most complex block in the system. It is modeled as a separate sub-editor within the canvas.

**Column model:**
```json
{
  "columns": [
    { "key": "lp", "type": "sequence", "label": "Lp.", "widthMode": "fixed", "width": 28, "align": "center" },
    { "key": "name", "type": "binding", "binding": "item.name", "label": "Nazwa", "widthMode": "flex", "flex": 3 },
    { "key": "quantity", "type": "binding", "binding": "item.quantity", "label": "Ilość", "widthMode": "fixed", "width": 45 },
    { "key": "unit", "type": "binding", "binding": "item.unit", "label": "J.m.", "widthMode": "fixed", "width": 35 },
    { "key": "unitNetPrice", "type": "computed", "binding": "item.unitNetPrice", "label": "Cena netto", "widthMode": "fixed", "width": 70, "format": "currency" },
    { "key": "discountPct", "type": "binding", "binding": "item.discountPct", "label": "Rabat %", "widthMode": "fixed", "width": 45, "visible": "capabilities.hasDiscount" },
    { "key": "vatRate", "type": "binding", "binding": "item.vatRate", "label": "VAT %", "widthMode": "fixed", "width": 45, "visible": "capabilities.hasVat" },
    { "key": "netAmount", "type": "computed", "binding": "item.netAmount", "label": "Wartość netto", "widthMode": "fixed", "width": 75, "format": "currency" },
    { "key": "vatAmount", "type": "computed", "binding": "item.vatAmount", "label": "Kwota VAT", "widthMode": "fixed", "width": 75, "format": "currency", "visible": "capabilities.hasVat" },
    { "key": "grossAmount", "type": "computed", "binding": "item.grossAmount", "label": "Wartość brutto", "widthMode": "fixed", "width": 80, "format": "currency" }
  ]
}
```

### Column presets by document type

| Document type | Preset | Hidden columns |
|---|---|---|
| `faktura_vat` | Full VAT | none |
| `proforma` | Full VAT | vatAmount (optional) |
| `oferta` | Commercial | vatRate optional, vatAmount optional |
| `wz` | Warehouse | price hidden, vatRate hidden, vatAmount hidden |
| `pz` | Warehouse | same as WZ |
| `mm` | Movement | price hidden |
| `zamowienie` | Order | discount visible, delivery date column added |

### Column editor UX

Accessed via right panel when items table block is selected. Shows a column list with:
- Enable/disable toggle per column
- Width input (px or auto)
- Label override
- Required columns locked (cannot disable: name, quantity, unit for faktura)
- Add custom column (for custom fields)
- Drag to reorder columns

### Multi-page behavior

Items table is the primary source of page overflow. Rules:
- Table header repeats on every page (configurable, default: on)
- Minimum 3 rows per page before splitting (orphan control)
- If a single row's description is very long, the row splits across pages with "continued" header
- Summary rows (totals) always appear on the last page of the table
- Page break before summary section if table overflows

### Row rendering

- Standard row: single-line. Overflow truncated with `...` in editor preview; in print, wraps.
- Long description: Description field can be multi-line. Editor shows estimated row height.
- Subtotal rows: A special row type that sums a subset of rows.
- Section header rows: A text-only row that acts as a category label within the table.

### Table overflow UX

In print preview, pages are shown as actual A4 sheets. The user can see the table continuing across pages. In edit mode, the table shows a "will continue on next pages" chip at the bottom if estimated content exceeds a single page.

### Column width management

**Auto mode**: Flex allocation. Named/description column gets remaining space after fixed columns.
**Manual mode**: Drag column dividers in the column header. Snap to 5mm increments. Width shown as tooltip during drag.
**Minimum width enforcement**: Each column type has a minimum width (e.g. `lp` minimum 20px, `currency` minimum 60px).

---

## H. LEGAL / COMPLIANCE UX

### Required fields engine

**Server-side**: `DocumentTypeCapabilitySchema` defines `requiredBindings[]` — binding paths that must be present and non-null for a document of this type.

**Client-side**: The validation engine reads the current template's bindings against `requiredBindings`. For each missing or unbound required path, an issue is produced.

**Issue severity levels:**

| Severity | Description | Publish | Issue |
|---|---|---|---|
| `BLOCKING` | Cannot publish or issue | Blocked | Blocked |
| `WARNING` | Can publish with acknowledgment | With acknowledgment | With explicit override |
| `INFO` | Advisory only | Free | Free |

### Warning display

**On canvas in edit mode:**
- Block with missing required binding: amber badge `⚠` in block top-right
- Section with any blocking issue: amber dot in section header
- Hovering badge shows tooltip with specific law reference and field explanation

**In right panel:**
- "Legal status" section at bottom of right panel
- Shows issues for selected block
- Shows document-level issues when nothing selected

**Before publish:**
- Full validation run
- Summary panel: grouped by BLOCKING / WARNING / INFO
- Each issue: affected block name, binding path, suggested fix, link to navigate to block
- Publish button shows `Resolve N issues before publishing` if blocking issues exist

### KSeF-ready mode

When `capabilities.hasKSeFFields = true`:
- A "KSeF readiness" tab in right panel
- Shows which fields map to KSeF schema elements
- Green checkmark per mapped field, amber for unmapped
- Advisory: "Ensure all KSeF required fields are bound before FA(2) submission"
- This is advisory only — KSeF submission is handled at document issue time, not template design time

### Polish-market aware hints

The system ships with a knowledge base of field-level hints:
- `counterparty.nip` → "NIP nabywcy wymagany dla faktur VAT wystawionych dla firm (B2B)"
- `document.saleDate` → "Data sprzedaży musi być podana gdy różni się od daty wystawienia"
- `document.paymentMethod` → "Wymagany dla faktur. Typowe: przelew, gotówka, karta"
- `totals.grossInWords` → "Słowna kwota brutto — wymagana w niektórych dokumentach"

These hints appear in the binding picker and in the block properties panel.

---

## I. TEMPLATE GOVERNANCE

### Version model

Every save creates a `draft snapshot` (auto-saved, not versioned). On publish, a `TemplateVersion` is created with:
- Sequential version number (1, 2, 3...)
- Immutable content hash
- Publisher user ID
- Publish timestamp
- Changelog text (optional, prompted on publish)
- Status: `published`

Published versions are never modified. Subsequent edits create new draft, new version on next publish.

### Status transitions

```
[new] → draft → published → archived
                     ↓
                 draft (new edit) → published (v2)
```

Archived versions are retained permanently for document render reproducibility. A document issued with `templateVersionId: 5` will always render using version 5, even if version 12 is current.

### Company override model

```
System Template (system_default=true)
    ↓ "Use as base" action
Company Template (company override)
    ↓ published
Active template for company
```

System templates are updated by system releases. Company overrides are independent. When a system template is updated (e.g. new KSeF fields), companies using overrides see a notification: "System template updated — review changes and update your override if needed."

### Version compare

UI: Select two versions from history panel → side-by-side diff view showing changed sections, changed bindings, changed style tokens, changed legal status. Not diff-as-text — diff-as-structured-block-comparison.

### Rollback

Admin can set any prior published version as "active" for a company. Takes effect immediately for new document issues. Documents already issued retain their original version snapshot.

### Permissions model

| Role | Create | Edit draft | Publish | Archive | Edit system defaults |
|---|---|---|---|---|---|
| System Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Company Admin | ✓ | ✓ | ✓ | ✓ | ✗ |
| Template Editor | ✓ | ✓ | ✗ | ✗ | ✗ |
| Regular User | ✗ | ✗ | ✗ | ✗ | ✗ |

**Safe editing in live org**: Templates in `published` status cannot be directly edited. Editing creates a new draft from the current published version. The published version remains active until the new draft is published. No live disruption.

### Schema migration

When a system schema version is bumped:
- A migration script runs against all affected `TemplateVersion` records
- `schemaVersion` field incremented
- Migration is additive — never removes user content
- Post-migration, a template review notification is shown to company admins

---

## J. DATA BINDING SYSTEM

### Canonical render context contract

ALL documents MUST be mapped into this shape before rendering.

```json
{
  "company": {},
  "counterparty": {},
  "document": {},
  "payment": {},
  "totals": {},
  "items": [],
  "warehouse": {},
  "shipment": {},
  "signatures": {},
  "user": {},
  "computed": {}
}
```

Mapping contract:

```ts
interface RenderContextMapper<T> {
  documentType: string;
  map(document: T): RenderContext;
}
```

NO renderer is allowed to access database entities directly.

### Binding namespace hierarchy

```
company.*
  .name, .legalName, .nip, .regon, .krs, .bdo
  .addressLine1, .addressLine2, .city, .postalCode, .country
  .phone, .email, .website
  .bankAccount, .bankName, .swift
  .logoUrl, .stampUrl
  .vatPayer, .vatExemptReason

counterparty.*
  .name, .legalName, .nip, .regon, .type (osoba/firma)
  .address.* (billing, delivery)
  .phone, .email
  .contractNumber, .salesRepName

document.*
  .number, .type, .typeLabel
  .issueDate, .saleDate, .servicePeriodFrom, .servicePeriodTo
  .currency, .exchangeRate, .exchangeRateDate
  .referenceNumber, .poNumber
  .notes, .privateNotes
  .status, .ksefNumber, .ksefDate

payment.*
  .method, .methodLabel
  .dueDate, .daysNet
  .bankAccount, .bankName
  .paid, .outstanding
  .qrPayload, .ksefPaymentRef

totals.*
  .net, .vat, .gross
  .grossInWords (computed, locale-aware)
  .byVatRate[].rate, .byVatRate[].net, .byVatRate[].vat, .byVatRate[].gross
  .discountTotal, .priceBeforeDiscount

items[*].*
  .lp (sequence)
  .name, .description, .sku, .ean
  .quantity, .unit
  .unitNetPrice, .unitGrossPrice
  .discountPct, .discountAmount
  .vatRate, .vatRateLabel
  .netAmount, .vatAmount, .grossAmount
  .warehouseCode, .batchNumber, .expiryDate

warehouse.*
  .source.name, .source.code, .source.address
  .destination.name, .destination.code, .destination.address
  .moveType, .moveReason
  .operator.name, .operator.position

shipment.*
  .carrier, .vehiclePlate, .driverName
  .deliveryDate, .deliveryMethod
  .trackingNumber

signatures.*
  .issuer.name, .issuer.position, .issuer.signatureUrl
  .receiver.name, .receiver.position
  .signedAt

user.*
  .name, .email, .position, .department

computed.*
  .totals.* (all computed from items)
  .document.age (days since issue)
  .payment.isOverdue
  .payment.daysOverdue
```

### Binding picker UX

**Trigger**: Click the `⟨ ⟩` binding icon on a block, or press `F2` when a text block is in editing mode.

**Panel**: Opens as an in-canvas popover. Three sections:
1. **Suggested** — bindings most commonly used with this block type
2. **All bindings** — searchable tree view, grouped by namespace
3. **Recent** — last 10 bindings used in this session

**Search**: Filters by path fragment AND by label. Typing "nip" shows `company.nip`, `counterparty.nip` and any block labeled "NIP".

**Sample value**: Every binding path shows its sample value inline (from sample data context).

**Insert mode**: Click to insert token `{{path}}` at cursor position in text block, or to set as the block's primary binding.

**Formatting suffix**: After selecting a path, if the path is date/number/currency, a formatter picker appears: `date.PL`, `date.ISO`, `currency.PLN`, `currency.EUR`, `number.2dp` etc.

### Fallback values

Every binding can have a fallback — value shown when binding resolves to null. Set in right panel per binding:
- Static text fallback: `"N/A"`, `"-"`, `"Brak danych"`
- Conditional hide: If null, hide this block entirely
- Error display: Show a visible error marker in preview (useful during template design)

### Token chips

In text blocks, bound tokens are rendered as interactive chips:
- Blue background, path label, hover shows full path + sample value
- Click chip → opens binding picker for that token
- Delete chip → removes binding and inserts plain text cursor at that position
- Chips are non-editable segments in the inline text editor

### Computed / Formula fields

For totals and complex values, computed fields use a limited expression language:
```
sum(items[*].netAmount)
items[*].quantity * items[*].unitNetPrice * (1 - items[*].discountPct / 100)
if(document.currency == "PLN", totals.gross, totals.gross * document.exchangeRate)
```

Computed fields are defined by the system for standard totals and are not user-editable in MVP. In Phase 2, power users can define custom computed fields.

---

## K. DEFAULT TEMPLATE STRATEGY

### Template catalog

**1. Minimal Clean**
- Character: white background, light grey borders, clean sans-serif, minimal decorative elements
- Best for: `proforma`, `oferta`, `zamowienie_zakupowe`
- Use when: You want a professional-but-simple look; client-facing quotations
- Who: Modern businesses, tech companies, startups

**2. Classic Polish**
- Character: traditional layout, clear header separation, blue accent, full label set, expected by Polish accountants
- Best for: `faktura_vat`, `faktura_zaliczkowa`, `nota`
- Use when: You're a Polish SME, need documents that look "standard"
- Who: Traditional businesses, accountants, regulated entities

**3. Modern Corporate**
- Character: dark top header band with company logo and primary color, clean body, premium typography
- Best for: `faktura_vat`, `potwierdzenie_zamowienia`, `oferta`
- Use when: Brand presentation matters; client-facing documents
- Who: Agencies, consultancies, B2B service companies

**4. Premium Branded**
- Character: Full brand customization, logo prominent, color band, accent on totals section, custom font
- Best for: `oferta`, `kontrakt`, `potwierdzenie_zamowienia`
- Use when: The document IS a brand touchpoint
- Who: Premium B2B, enterprise accounts

**5. Warehouse Compact**
- Character: Dense, functional. Small font, minimal spacing, maximum data per page, clear table structure
- Best for: `wz`, `pz`, `mm`, `rw`
- Use when: Warehouse operations, printed on A4 and attached to physical goods
- Who: Logistics teams, warehouse managers

**6. Bilingual PL/EN**
- Character: Two-column label layout (Polish label left, English right), or bilingual section headers
- Best for: `faktura_vat` for export, `oferta` for international clients
- Use when: Counterparty is foreign or document needs to be readable in both languages
- Who: Exporters, international businesses

**7. KSeF-Ready Invoice**
- Character: Standard invoice with KSeF reference block, QR code block for verification, all KSeF-required fields bound and visible
- Best for: `faktura_vat` with KSeF submission
- Use when: Company is in KSeF mandatory phase
- Who: All businesses required to use KSeF

**8. Export / International**
- Character: English-primary, IBAN/SWIFT fields prominent, EUR currency support, international date formats
- Best for: `faktura_vat` for EU customers, `proforma` for customs
- Use when: Exporting goods/services internationally

---

## L. VISUAL DESIGN SYSTEM FOR THE BUILDER

### Visual language

The builder lives in the CRM/ERP's premium dark glass environment. The canvas itself (the document) is always white/light — this is a deliberate contrast: **the workspace is dark, the document is clean paper-white**. This immediately communicates "you are designing a physical document, not a screen UI."

### Density

**Workspace chrome**: Compact. Left panel 240px, right panel 280px. Top bar 48px.

**Canvas**: A4 proportion, centered, with 40px workspace padding around it. At 100% zoom this is the actual print size.

**Panels**: Information-dense without being overwhelming. 12px base, 13px for labels. 8px vertical rhythm. Sections within panels separated by 1px borders, not large gaps.

### Typography

- **Workspace UI**: `Inter` or `system-ui`, 12–13px for panel labels, 11px for secondary info
- **Document canvas**: The template's chosen font, rendered at print size. No UI chrome typography bleeds into the canvas.
- **Token chips**: Monospace, small (10px), blue, inline

### Cards and panels

Left and right panels: dark glass background (`rgba(15, 20, 35, 0.92)`) with a 1px subtle border (`rgba(255,255,255,0.06)`). Not opaque black — slightly translucent against the dark workspace.

Section cards on canvas: white/near-white background, 1px border (`#e2e8f0`), 4px border-radius. When selected: 2px blue border, subtle outer glow. When hovered: thin blue border with 40% opacity.

Property groups in right panel: collapsible, with subtle divider lines. Expanded by default if relevant. No heavy card boxes — just grouped label+control rows.

### States

| State | Visual treatment |
|---|---|
| Drag active | 80% opacity + slight scale (1.02) on dragged element |
| Drop zone | 2px dashed blue line with subtle blue fill |
| Selected | 2px solid `#2563eb` border |
| Hovered | 1px dashed `rgba(37,99,235,0.5)` border |
| Focus (keyboard) | 2px `#2563eb` ring with 2px offset |
| Locked | 0.7 opacity + lock icon, `not-allowed` cursor on drag |
| Warning | Amber left border (`#f59e0b`) on block, amber dot on section |
| Error | Red border + "!" icon (post-validation only) |

### Token chips

Inline in text blocks: `background: rgba(37,99,235,0.15)`, `color: #93c5fd`, `border: 1px solid rgba(37,99,235,0.3)`, `border-radius: 3px`, `padding: 0 4px`, `font-family: monospace`. The blue-tinted chip is immediately recognizable as data, not static text.

### Drop indicators

A 2px tall line with a blue glow, appearing between blocks/sections to indicate insert position. Accompanied by a small directional arrow. Appears after 200ms hover — prevents flicker.

### Ruler and guides

Ruler background: dark (`#0f1523`), tick marks in `rgba(255,255,255,0.3)`. Current mouse position shown as a red hairline cursor on both rulers.

Guides (if enabled): `rgba(59,130,246,0.5)` dashed lines. Snap indicator: blue label showing distance from guide.

### Canvas shadows

Document page on workspace: `box-shadow: 0 4px 32px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)`. Realistic paper-on-dark-surface feel.

### The premium benchmark

The editor should feel like it was designed by someone who has used Notion, Linear, and Figma — but built specifically for documents. Its own calm, precise, confident visual language.

Avoid: heavy gradients, glows for decoration, excessive animation, bright accent colors everywhere.
Use: confident typography, precise alignment, meaningful micro-interactions, consistent 8px grid.

---

## M. SCREEN-BY-SCREEN UX FLOWS

### Flow 1: Create new template from scratch

1. Navigate to Company Settings → Templates → "New Template"
2. Step 1 modal: Select document type (grid of cards with icons, grouped by family)
3. Step 2 modal: Choose start — "Best practice template" (recommended, shows preview thumbnail), "Minimal structure", "Duplicate existing"
4. Editor opens. First-run guide: 3 blue annotation chips on canvas. "Click × to dismiss when ready."
5. Right panel shows document settings. User sets company brand color, font.
6. Editor ready.

### Flow 2: Create Faktura VAT template

1. Select `faktura_vat` document type
2. System pre-loads: Header (logo + company data), Seller/Buyer (two-column), Document Meta (number, dates, currency), Items Table (full VAT columns), Totals, Payment, Notes, Legal Footer
3. Legal footer block is locked with "Required by Polish VAT law"
4. Right panel shows "Legal status" at bottom: 2 INFO hints about KSeF readiness
5. User customizes colors, fonts, logo size
6. User adds Payment QR block from left panel — drags into Payment section
7. User switches locale to EN, sees English labels, translates "Sprzedawca" → "Seller"
8. User clicks Preview — sees document with sample data, checks layout
9. User clicks Publish — validation passes, publishes as v1

### Flow 3: Create WZ template

1. Select `wz` document type
2. System loads: Header, Seller/Receiver (WZ variant — "Odbiorca" not "Nabywca"), Document Meta, Items Table (no price columns by default), Warehouse block, Goods Receipt (signature), Notes
3. Items table column editor auto-configures warehouse preset (no price, no VAT, show batch + expiry)
4. Price-related blocks (Totals, Payment) not available in left panel — greyed with "Not supported for WZ"
5. User adds Carrier block
6. User configures Goods Receipt block — two signature lines, "Wydał" and "Odebrał"

### Flow 4: Create bilingual offer

1. Select `oferta` document type
2. Choose "Bilingual PL/EN" starting template
3. Canvas shows document with dual-language label columns
4. Top bar shows `PL | EN` locale switcher. Switching between them shows how the document looks in each language.
5. User sets binding `document.validityDate` on Offer Validity block
6. User adds signature block
7. User previews in PL, previews in EN — both look correct

### Flow 5: Editing existing published template safely

1. Navigate to template, status: `Published v3`
2. Click "Edit" — system creates a draft copy of v3 automatically
3. Banner at top: "Editing draft from v3. Published version remains active until you publish."
4. User makes changes
5. Clicks Publish → validation runs → change summary shown
6. User confirms → published as v4. v3 archived but retained.

### Flow 6: Preview before publishing

1. Click "Preview" in top bar
2. Mode switches: panels collapse to minimal strip, canvas shows document with sample data
3. Top bar shows: `Sample data | Real data` toggle
4. Locale switcher still active
5. "Print preview" button: opens multi-page spread view, shows exact A4 pages

### Flow 7: Test render with sample data

In Preview mode, "Sample data" selector opens a drawer:
- Data preset: "Standard B2B invoice", "Small order", "Multi-item with discount", "International EUR"
- Each preset fills all bindings with realistic Polish business data
- User sees how the template handles various data scenarios (long names, many items, EUR currency)

### Flow 8: PDF/print preview

"Print preview" mode: renders through the actual PDF pipeline (server-side) and shows the result as embedded PDF or multi-page A4 sheets. This is the highest-fidelity check before publish. Any rendering discrepancy between canvas and PDF is shown as a warning.

### Flow 9: Assign template to document type / use case

1. Navigate to template → Settings tab
2. "Scope": set as default for `faktura_vat` for this company
3. Alternatively: assign to specific use case ("Export invoices", "Domestic invoices")
4. Use case selection appears when issuing a document: "Which template to use for this invoice?"

---

## N. RECOMMENDED FRONTEND ARCHITECTURE

### State model

```
EditorStore (local, not persisted)
├── draft: TemplateVersionDraft (full schema, mutable)
├── ui:
│   ├── selectedSectionKey: string | null
│   ├── selectedBlockKey: string | null
│   ├── selectedFieldKey: string | null
│   ├── editorMode: 'design' | 'preview' | 'print'
│   ├── localeMode: 'pl' | 'en' | 'de'
│   ├── zoom: number
│   ├── showRulers: boolean
│   ├── showGuides: boolean
│   ├── activeLeftTab: 'sections' | 'blocks' | 'data'
│   └── rightPanelExpanded: boolean
├── interaction:
│   ├── dragState: DragState | null
│   ├── resizeState: ResizeState | null
│   └── fieldWidthPending: { fieldKey, width } | null
├── history:
│   ├── past: TemplateVersionDraft[]  (max 50)
│   ├── future: TemplateVersionDraft[]
│   └── checkpoint: string (last saved state hash)
└── validation:
    ├── issues: ValidationIssue[]
    ├── lastValidated: timestamp
    └── isValid: boolean
```

### Command pattern / history

Every user action that modifies `draft` goes through a command:

```js
// Command interface
{ type: string, apply: (draft) => draft, describe: () => string }

// Examples
SectionReorderCommand({ fromKey, toKey })
BlockAddCommand({ sectionKey, blockType, position })
FieldRemoveCommand({ sectionKey, fieldKey })
StyleTokenUpdateCommand({ tokenKey, value })
BindingSetCommand({ blockKey, fieldKey, bindingPath })
```

The history stack stores full draft snapshots (not diffs) for simplicity at MVP scale. With a ~50-step limit, memory impact is acceptable for A4 document schemas. If performance becomes an issue in Phase 2, migrate to operation-based diff history (Immer patches).

### Hooks architecture

```
useEditorStore()           — full draft access + dispatch
useEditorSelection()       — selectedSectionKey, selectedBlockKey, selectedFieldKey + setters
useEditorHistory()         — undo, redo, canUndo, canRedo
useEditorValidation()      — issues, validate(), isValid
useBlockInteractions()     — drag, resize, field width handlers
useEditorPreview()         — preview mode state, locale, zoom
useDocumentCapabilities()  — capabilities for current documentType
useBindingPicker()         — binding namespace tree, search, insert
useStyleTokens()           — current styleTokens, update handler
```

### Renderer architecture

The renderer is a **pure function**: `render(templateDraft, dataContext, renderCtx?) → ReactTree`.

`renderCtx` enables editing interactions when non-null. The renderer is shared between:
- Editor preview (renderCtx active for selected section)
- Preview mode (renderCtx null)
- Print mode (renderCtx null, channel: print)
- System render service (server-side React render, renderCtx null)

**Critical rule**: The renderer never imports from the editor store. It receives everything it needs as props. This enables server-side rendering without editor dependencies.

### Inspector architecture

`SectionInspector` component:
- Receives `{ section, documentTypeCapabilities, styleTokens, onUpdate }`
- Self-contained: renders all section-level and block-level property panels
- No direct store access — pure controlled component
- Composed from: `BlockPropertyPanel`, `StylePanel`, `BindingPanel`, `VisibilityPanel`, `LegalStatusPanel`

### Drag-drop engine

Uses `@dnd-kit` for all drag-drop interactions:
- Section reorder: `verticalListSortingStrategy`, `DndContext` at canvas level
- Block reorder within section: `verticalListSortingStrategy`, `DndContext` at section level
- Field reorder within block: `verticalListSortingStrategy`, `DndContext` at block level
- Cross-section block move: custom collision detection, drop zone indicator components
- Block library drag-to-canvas: `DragOverlay` + `useDroppable` on sections

### Page calculation engine

A dedicated `PageCalculator` module:
- Input: `sectionList`, `pageSettings`, `estimatedRowHeights`
- Output: `PageModel[]` — each page has a list of section fragments
- Pure function, no DOM dependency for the model
- Uses heuristic heights for items table (row height × count + header)
- In print preview mode: triggers actual server-side render to get precise page layout

### Measurement system

### Page layout model

```ts
interface PageModel {
  pageNumber: number;
  blocks: PageFragment[];
}

interface PageFragment {
  type: 'block' | 'section' | 'table';
  height: number;
}
```

Responsibilities:
- page splitting
- table continuation
- header repeat
- footer handling

CRITICAL:
Preview and PDF MUST use the same model.

DOM measurement (`getBoundingClientRect`) is used only for:
1. Selection rect highlighting (to draw overlay over selected section)
2. Ruler display (cursor position)

Page layout calculation is never DOM-dependent — computed purely from schema + measurement constants. The selection rect is computed via `ResizeObserver` on section refs, not `useLayoutEffect` + `getBoundingClientRect` on every render. This eliminates DOM reflow cascades.

---

## O. RECOMMENDED BACKEND ARCHITECTURE

### Template storage

**PostgreSQL** (structured relational):
```sql
templates (id, company_id, document_type_key, name, status, current_version_id, created_at, updated_at)
template_versions (id, template_id, version_number, schema_version, published_at, publisher_user_id, changelog, content_hash)
template_version_content (template_version_id, content JSONB)
```

`content JSONB` stores the full serialized `TemplateVersionDraft` schema. `content_hash` allows fast equality checks and cache invalidation.

**Index strategy**: `(company_id, document_type_key, status)` for "find active template for this company and document type". `template_version_id` indexed for direct render lookups.

### Validation service

`POST /api/templates/:id/validate`
Input: current draft
Output: `{ issues: ValidationIssue[], isValid: boolean }`

Validates:
- Schema structure against JSON Schema
- Required bindings against `DocumentTypeCapabilitySchema`
- Legal constraints against `LegalConstraintRuleSet`
- Locale variant completeness
- Block registry: all block types exist and are allowed for this document type

### Render service

`POST /api/render/template-preview` — fast preview with sample data
`POST /api/render/document` — full document render for issue
`GET /api/render/document/:documentId/pdf` — PDF export

**Render pipeline:**
```
TemplateVersionSnapshot + DataContext
  → SchemaValidator (fast check)
  → BindingResolver (resolve all {{tokens}} against DataContext)
  → VisibilityEvaluator (apply conditional rules)
  → LocaleApplicator (apply active locale variant)
  → StyleTokenExpander (resolve all token references to CSS values)
  → ReactServerRenderer (render to HTML string)
  → CSSInliner (for email channel)
  → PDFGenerator (Puppeteer or WeasyPrint for print/pdf channel)
  → Output
```

**PDF generation recommendation**: Use Puppeteer (headless Chrome). Reasons: exact CSS support, identical to browser print preview, handles modern fonts, flexbox, custom properties. Output: PDF/A-1b for archival.

### Document capability registry

A server-side registry (seeded, not user-editable in MVP):
```js
DocumentTypeRegistry.get('faktura_vat') → {
  capabilities: { hasVat: true, hasKSeFFields: true, ... },
  requiredBindings: ['company.nip', 'document.number', 'document.issueDate', ...],
  legalConstraintRuleSetKey: 'PL_VAT_2024',
  defaultSections: ['header', 'seller_buyer', ...],
  forbiddenSections: [],
  lockedSections: ['legal_footer'],
  allowedBlockTypes: [...],
  forbiddenBlockTypes: ['warehouse_block', 'carrier_block']
}
```

### Compliance rules engine

A rules engine (server-side) that applies to template validation and document issue validation:
- Rules stored as structured JSON (not code), versioned, updatable without deploy
- Rule types: `RequiredFieldRule`, `ForbiddenFieldRule`, `ConditionalRequiredRule`, `FormatValidationRule`
- Example: `{ rule: "RequiredField", binding: "document.saleDate", condition: "document.type == 'faktura_vat'", severity: "BLOCKING", locale_hint: { pl: "Data sprzedaży wymagana na FV" } }`
- Rules can be updated when Polish VAT law changes without touching application code

### Asset management

Company logos, fonts, stamps stored in `FILES_STORAGE_ROOT` with HMAC-signed URLs (existing infrastructure). Templates reference assets by URL. On PDF render, assets fetched and inlined.

### Preview service

For fast editor previews:
- Server-side render with sample data
- Response: HTML string (for iframe embed) or base64 PNG (for thumbnail)
- Cached by `content_hash` of draft — same draft returns cached preview
- Cache TTL: 5 minutes

---

## P. TRADEOFFS AND DECISIONS

### 1. Free-form canvas vs structured canvas

**Free-form** (Figma/Canva-like): Full pixel-level positioning. Complete design freedom. Poor for variable-length data. Breaks on multi-page content. Users can produce legally non-compliant layouts. Very hard to bind to live data reliably.

**Structured** (zone-based): Documents have named sections. Layout is constrained within sections. Data binding is reliable. Legal required sections are enforceable. Multi-page behavior is deterministic.

**Decision: Structured canvas with section-level freedom.**
Sections are the atom of layout. Within a section, blocks can be positioned flexibly (flex-row, flex-col, grid). Users cannot place content outside section boundaries. This matches how real business documents work.

### 2. Absolute positioning vs smart flow layout

**Absolute**: Precise pixel positions for every block. Easy to implement editor. Terrible for variable-length content. Breaks on font changes.

**Flow layout**: CSS flex/grid within sections. Blocks flow naturally. Handles variable content.

**Decision: Flow layout within sections, with explicit width/height configuration where needed.**
Items table and signature blocks can have explicit width. Text blocks flow. This matches how print CSS works natively and produces the most reliable PDF output.

### 3. Single-page mental model vs real multi-page print model

The editor always works in a single-page conceptual model. Multi-page layout is computed at render time from actual data.

**Decision: Single-page template design model, multi-page render model.**
The editor shows one page of the template. Page breaks are shown as estimated hints in preview. Full multi-page is only shown in print preview mode (rendered against actual/sample data).

### 4. Block tree vs full free design

Block tree means all content lives in typed blocks with schemas. Full free design means arbitrary HTML/CSS.

**Decision: Block tree, always.**
Block tree enables: type-safe binding, legal constraint checking, schema migration, localization, channel adaptation, validation. Full free design gives none of these.

### 5. Flexibility vs safety

Too flexible: users can accidentally remove required legal blocks, hide required bindings, produce compliant-looking but legally wrong documents.

Too safe: users cannot customize anything meaningful, fall back to Word.

**Decision: Structured safety with explicit override mechanism.**
Required blocks are locked by default. User can unlock with an explicit "I understand the legal implications" confirmation. This is logged for audit.

### 6. Legal safety vs design freedom

**Decision: Binding presence, not position, is legally required.**
The system requires that `company.nip` is bound to at least one visible block. It does not require that block to be in any specific location. This separates compliance (data presence) from design (visual placement).

### 7. Easy builder vs power builder

**Decision: Template editor is a power tool. Document issuance is a simple tool.**
The template editor is explicitly a power-user tool. It is not accessed during normal document issuance — only during template setup. Document issuance uses a separate, simple UI that just applies the template.

---

## Q. FINAL RECOMMENDATION

### 1. Recommended product direction

Build a **structured document production system** with a canvas-first editor that is purpose-built for Polish business document requirements. It is not a general design tool — it is an ERP-native document authoring system with a visual editor as the primary interface.

### 2. Recommended UX model

Section-based canvas with flow layout within sections. Document types define which sections are available, required, and locked. The canvas is always A4, always print-accurate. Editing is section → block → field. Right panel is context-sensitive. Preview mode shows the document with injected sample data at all times.

### 3. Recommended technical architecture

| Layer | Choice | Reason |
|---|---|---|
| Schema storage | JSONB in PostgreSQL | Structured, queryable, migratable |
| Renderer | React (shared client/server) | Pure function, no editor deps, SSR-ready |
| State management | Zustand + command pattern | Lightweight, history-friendly |
| Drag-drop | `@dnd-kit` | Accessible, composable, already in use |
| PDF generation | Puppeteer (headless Chrome) | Pixel-perfect match to canvas preview |
| Compliance engine | Rules-as-data on server | Updatable without deploys |
| Validation | Client (fast) + Server (authoritative) | Best of both worlds |

### 3.1 Phased delivery model

| Phase | Goal |
|------|------|
| M1 | Contracts + schema |
| M2 | Backend foundation |
| M3 | Editor shell |
| M4 | Renderer |
| M5 | Faktura + Oferta |
| M6 | Advanced UX |
| M7 | Governance |
| M8 | Compliance + KSeF |

Rule:
Architecture must NOT be simplified for early phases.
Only feature surface is reduced.

### 4. MVP scope

- Template CRUD with version history
- 5 document types: `faktura_vat`, `proforma`, `oferta`, `wz`, `zamowienie`
- Section-level canvas (reorder, enable/disable, basic settings)
- Block library: 12 core blocks
- Data binding with binding picker
- 3 default starting templates (minimal, classic Polish, warehouse compact)
- Print / PDF export via Puppeteer
- Validation: required bindings check before publish
- Locales: PL, EN

### 5. Phase 2 scope

- Field-level editing within blocks (in-canvas field selection, resize, reorder)
- All warehouse document types (pz, mm, rw, pw)
- Advanced block library (KSeF QR, barcode, payment QR, carrier, goods receipt)
- Column editor for items table (add/remove/reorder columns)
- Template versioning UI (compare versions, rollback)
- Company override model
- Locale: DE, UK
- Legal hints and compliance engine
- Custom computed fields (basic formula support)

### 6. What should never be done

- **Never free-form positioning** — it breaks on variable data, it breaks on print, it makes legal compliance unenforceable
- **Never Word/HTML export as "templates"** — this is the old world; it's the problem we're solving
- **Never duplicate legal rules in templates** — legal constraints live in the server registry, not in individual templates
- **Never allow live template edits without draft model** — always create a draft, always publish explicitly
- **Never render without a templateVersionId** — documents must reference immutable version snapshots
- **Never skip the PDF accuracy check** — the canvas preview and the PDF output must match

### 7. What will differentiate us from weak competitors

1. **Print accuracy**: Canvas matches PDF output exactly. Other builders have a gap between what you see and what you get. We don't.
2. **Compliance as infrastructure**: Legal required fields are enforced at schema level, not as a checklist in a manual. Users cannot accidentally produce non-compliant documents.
3. **Data-binding as first-class concept**: Every field is a binding. Tokens are visual, inspectable, and searchable. Not just `{placeholder_text}` in a text box.
4. **Multi-document architecture**: One system for all document types with capability flags, not 12 separate editors bolted together.
5. **Versioned, auditable, enterprise-grade governance**: Template history, company overrides, safe editing model. Not an afterthought.
6. **Real multi-page print model**: The system actually understands page overflow, table continuation, header repetition — it doesn't just render and hope for the best.

### 8. What will make this system feel like technological magic

- **The moment a user selects a binding path and sees a real sample value appear in the canvas in real-time** — they understand that the template is alive, not static text.
- **The moment they click "Print preview" and see a perfect multi-page A4 PDF** that looks exactly like the canvas — no surprises, no gaps between design and output.
- **The moment they switch locale to EN** and watch the entire document relabel itself while all data bindings stay unchanged — and realize the template is a single source of truth for all languages.
- **The moment they try to remove a required legal block** and the system explains exactly *why* it's required, *what law requires it*, and lets them proceed anyway if they accept responsibility — not just silently blocking them.
- **The moment a new accountant at the company opens the system** and gets a best-practice Faktura VAT template for free, fully bound, correctly structured, that just works — without configuring anything.

This is the difference between a template editor and a document production system. We are building the latter.

---

*End of specification. This document covers product vision through technical architecture and is the foundational reference for design, engineering, and product roadmap decisions.*

---

## R. IMPLEMENTATION READINESS CHECKLIST

Before coding:

- RenderContext defined
- Template schema stable
- Block registry defined
- Page model defined
- Validation model defined

If not — DO NOT START FULL IMPLEMENTATION.
