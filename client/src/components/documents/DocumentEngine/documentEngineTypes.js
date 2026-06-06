// Generic DocumentEngine view-model shape (JSDoc only — no runtime export of types).
// Pages build this each render and pass it as <DocumentEnginePage model={...} />.
// Granular props passed alongside `model` override the corresponding model keys.

/**
 * @typedef {Object} DocumentEngineField
 * @property {string} label
 * @property {string} [value]      display value (preview) or control value (edit)
 * @property {'text'|'date'|'textarea'|'select'} [type]  edit control type
 * @property {(value:string)=>void} [onChange]  presence + edit mode → editable control
 * @property {{value:string,label:string}[]} [options]  for type:'select'
 */

/**
 * @typedef {Object} DocumentEngineLine
 * @property {string} key
 * @property {string} name
 * @property {string} [lineTypeLabel]
 * @property {string} [lineTypeTone]
 * @property {boolean} [affectsStock]
 * @property {string|number} qty
 * @property {string} [unit]
 * @property {number} priceNet
 * @property {number} vatRate
 * @property {number} sumNet
 * @property {number} sumVat
 * @property {number} sumGross
 */

/**
 * @typedef {Object} DocumentEngineModel
 * @property {'preview'|'edit'} [mode]
 * @property {string} typeLabel
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} number
 * @property {string} statusLabel
 * @property {string} [summaryStatusLabel]
 * @property {{label:string,onClick:Function}} [back]
 * @property {string} [breadcrumb]
 * @property {{label:string,value:string,muted?:boolean}[]} [facts]
 * @property {string} [paramsTitle]
 * @property {DocumentEngineField[]} [primaryFields]
 * @property {DocumentEngineField[]} [secondaryFields]
 * @property {DocumentEngineLine[]} [items]
 * @property {React.ReactNode} [itemsSlot]  editable items node (edit mode)
 * @property {{netLabel:string,vatLabel:string,grossLabel:string,net:number,vat:number,gross:number}} [totals]
 * @property {{key:string,title:string,hint?:string,content:React.ReactNode}[]} [sections]  relations / history
 * @property {Array} [actions]  business actions
 * @property {{label:string,text:string}} [lockedNote]
 * View-mode + save cluster (page-owned state/callbacks):
 * @property {boolean} [showViewModeToggle]
 * @property {'preview'|'edit'|'split'} [viewMode]
 * @property {(mode:string)=>void} [onViewModeChange]
 * @property {string[]} [viewModeDisabledModes]
 * @property {boolean} [showPrintButton]
 * @property {Function} [onPrint]
 * @property {boolean} [showSaveButton]
 * @property {Function} [onSave]
 * @property {boolean} [saveDisabled]
 * @property {boolean} [saveLoading]
 */

export {};
