import type { DataContext } from './dataContext'
import type { DocumentTypeCapabilities } from './documentType.types'
import type { PageModel } from './pageModel.types'

export type RenderMode = 'editor_preview' | 'screen_view' | 'print' | 'pdf' | 'email_html' | 'system_export'

export type ChannelMode = 'editor' | 'screen' | 'print' | 'pdf' | 'email' | 'export'

/**
 * Runtime render environment contract.
 *
 * DataContext (see dataContext.ts) is the canonical document data contract.
 * RenderContext only carries environment/runtime controls for rendering.
 */
export interface RenderContext {
  mode: RenderMode
  channel: ChannelMode
  locale: string
  selectedSectionKey?: string | null
  selectedBlockKey?: string | null
  selectedFieldKey?: string | null
  isEditorInteractive?: boolean
  capabilities?: DocumentTypeCapabilities
  pageModel?: PageModel | null
}

export interface RenderInput {
  dataContext: DataContext
  renderContext?: RenderContext | null
}
