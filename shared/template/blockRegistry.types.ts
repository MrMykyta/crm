export interface BlockLayout {
  widthMode: 'auto' | 'fraction' | 'fixed'
  widthValue?: number
  minWidthPx?: number
}

export interface BlockBindingSchema {
  supportedPaths: string[]
  requiredPaths?: string[]
}

export interface BlockRenderBehavior {
  supportsPrint: boolean
  supportsPdf: boolean
  supportsPreview: boolean
}

export interface BlockRegistryEntry {
  type: string
  displayName: string
  family?: string
  allowedDocumentTypes?: string[]
  forbiddenDocumentTypes?: string[]
  requiredCapabilityFlags?: string[]
  defaultProps: Record<string, unknown>
  propertySchema?: Record<string, unknown>
  layout: BlockLayout
  bindingSchema?: BlockBindingSchema
  renderBehavior?: BlockRenderBehavior
}
