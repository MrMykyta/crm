export type ValidationSeverity = 'BLOCKING' | 'WARNING' | 'INFO'

export type ValidationIssue = {
  severity: ValidationSeverity
  code: string
  message: string
  target?: {
    sectionKey?: string
    blockKey?: string
    fieldKey?: string
  }
}
