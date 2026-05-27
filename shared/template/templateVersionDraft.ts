export type PageSize = string

export interface TemplateMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface TemplatePageSettings {
  size: PageSize
  orientation: 'portrait' | 'landscape'
  margins: TemplateMargins
}

export type SectionLayoutMode = 'flow' | 'grid' | 'fixed'

export type HorizontalAlign = 'start' | 'center' | 'end'

export interface TemplateBinding {
  path: string
  format?: string | null
  fallback?: string | null
  hideWhenNull?: boolean
}

export interface TemplateBlockLayout {
  widthMode?: 'auto' | 'fraction' | 'fixed'
  widthValue?: number
  minWidthPx?: number
  horizontalAlign?: HorizontalAlign
}

export interface TemplateBlockInstance {
  key: string
  type: string
  props: Record<string, unknown>
  layout?: TemplateBlockLayout
  bindings?: Record<string, TemplateBinding>
  visibilityCondition?: string
}

export interface TemplateSection {
  key: string
  type: string
  order: number
  enabled: boolean
  locked: boolean
  layoutMode: SectionLayoutMode
  pageBreakBefore?: boolean
  visibilityCondition?: string
  blocks: TemplateBlockInstance[]
}

export interface PrintSettings {
  headerRepeat: boolean
  tableHeaderRepeat: boolean
  pageBreakBefore: string[]
  orphanControl: boolean
}

export interface LegalConstraints {
  inherited: boolean
  documentTypeKey: string
  // TODO(M4+): replace unknown[] with typed legal rule override contract.
  overrides: unknown[]
}

export interface TemplateVersionDraft {
  templateVersionId?: string
  templateName: string
  documentTypeKey: string
  schemaVersion: number
  defaultLocale: string
  page: TemplatePageSettings
  sections: TemplateSection[]
  styleTokens: Record<string, string | number | boolean>
  locales: Record<string, Record<string, string>>
  printSettings: PrintSettings
  legalConstraints: LegalConstraints
  numberingPresetKey?: string | null
  layoutPresetKey?: string | null
}
