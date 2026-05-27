export const DOCUMENT_VIEW_MODES = Object.freeze({
  EDIT: 'edit',
  SPLIT: 'split',
  PREVIEW: 'preview',
});

export const DOCUMENT_VIEW_MODE_OPTIONS = Object.freeze([
  Object.freeze({ value: DOCUMENT_VIEW_MODES.EDIT, label: 'Редакт.' }),
  Object.freeze({ value: DOCUMENT_VIEW_MODES.SPLIT, label: 'Сплит' }),
  Object.freeze({ value: DOCUMENT_VIEW_MODES.PREVIEW, label: 'Просмотр' }),
]);
