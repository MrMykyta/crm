export interface DocumentTypeCapabilities {
  hasVat: boolean
  hasKSeFFields: boolean
  hasPaymentBlock: boolean
  hasItemTable: boolean
  itemTablePriceVisible: boolean
  hasWarehouseBlock: boolean
  hasSignatureBlock: boolean
  hasCarrierBlock: boolean
  hasCorrectionReference: boolean
  hasAdvanceReference: boolean
  isLegalDocument: boolean
  requiresSellerNip: boolean
  requiresBuyerNip: boolean
  requiresLegalFooter: boolean
  allowedLocales: string[]
  defaultLocale: string
}

export interface DocumentTypeCapabilitySchema {
  key: string
  displayName: string
  family?: string
  capabilities: DocumentTypeCapabilities
  requiredSections: string[]
  forbiddenSections: string[]
  lockedSections: string[]
  requiredBindings: string[]
  legalConstraintRuleSetKey: string
  defaultSections: string[]
  allowedBlockTypes: string[]
  forbiddenBlockTypes: string[]
  allowedItemTableColumnSets?: string[]
  sectionHeightEstimates?: Record<string, number>
}
