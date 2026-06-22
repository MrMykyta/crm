import React from 'react';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getDetailSections(config = {}) {
  return asArray(config?.rowController?.detailSections);
}

function getPathValue(source = {}, path = '') {
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), source);
}

function isSectionVisible(section = {}, ctx = {}) {
  if (!section.visibleWhen) return true;
  if (typeof section.visibleWhen === 'function') return Boolean(section.visibleWhen(ctx));
  const expression = String(section.visibleWhen);
  if (expression.endsWith(' exists')) {
    const path = expression.replace(/\s+exists$/, '');
    return getPathValue(ctx, path) !== undefined;
  }
  return Boolean(getPathValue(ctx, expression));
}

function getDetailSectionForColumn(config = {}, column = {}, ctx = {}) {
  const sections = getDetailSections(config);
  return sections.find((section) => {
    if (section.placement && section.placement !== 'column') return false;
    const matches = section.columnKey === column.key
      || section.key === column.detailSection
      || asArray(section.fields).includes(column.key);
    return matches && isSectionVisible(section, ctx);
  }) || null;
}

function getSectionField(section = {}, fallback = '') {
  return section.field || asArray(section.fields)[0] || fallback;
}

function translate(labels = {}, key = '', fallback = '') {
  return typeof labels.translate === 'function' && key ? labels.translate(key, fallback) : fallback;
}

function getSectionLabel(section = {}, column = {}, labels = {}) {
  if (section.labelKey) return translate(labels, section.labelKey, section.label || column.label || section.key || column.key || '');
  if (column.labelKey) return translate(labels, column.labelKey, section.label || column.label || section.key || column.key || '');
  return section.label || column.label || section.key || column.key || '';
}

function renderInputSection(ctx) {
  const {
    column,
    disabled,
    row,
    rowWarnings,
    section,
    onCellKeyDown,
    updateRow,
  } = ctx;
  const field = getSectionField(section, column.key);
  return React.createElement(
    'span',
    { className: 'wmsShellDetailCell' },
    React.createElement('span', { className: 'wmsShellDetailLabel' }, getSectionLabel(section, column, ctx.labels)),
    React.createElement('input', {
      className: section.inputClassName || column.inputClassName || 'wmsShellInput',
      value: row[field],
      onChange: (event) => updateRow(row.localId, { [field]: event.target.value }),
      onKeyDown: (event) => onCellKeyDown?.(event, row, column),
      disabled,
    }),
    rowWarnings[field]
      ? React.createElement('div', { className: 'wmsShellFieldWarning' }, rowWarnings[field])
      : null
  );
}

function renderCostSection(ctx) {
  const {
    column,
    disabled,
    row,
    rowWarnings,
    section,
    onCellKeyDown,
    updateRow,
  } = ctx;
  const field = getSectionField(section, column.key);
  return React.createElement(
    'span',
    { className: 'wmsShellDetailCell' },
    React.createElement('span', { className: 'wmsShellDetailLabel' }, getSectionLabel(section, column, ctx.labels)),
    React.createElement('input', {
      className: section.inputClassName || column.inputClassName || 'wmsShellInput',
      type: 'number',
      step: section.step || column.step || '0.0001',
      value: row[field],
      onChange: (event) => updateRow(row.localId, { [field]: event.target.value }),
      onKeyDown: (event) => onCellKeyDown?.(event, row, column),
      disabled,
    }),
    rowWarnings[field]
      ? React.createElement('div', { className: 'wmsShellFieldWarning' }, rowWarnings[field])
      : null
  );
}

function renderReadonlySection({ column, labels, row, section }) {
  const field = getSectionField(section, column.key);
  return React.createElement(
    'span',
    { className: 'wmsShellDetailCell' },
    React.createElement('span', { className: 'wmsShellDetailLabel' }, getSectionLabel(section, column, labels)),
    React.createElement('span', { className: 'wmsShellDetailValue' }, row[field] || '-')
  );
}

const detailSectionRenderers = {
  lot: renderInputSection,
  note: renderInputSection,
  cost: renderCostSection,
  readonly: renderReadonlySection,
};

function getDetailSectionRenderer(section = {}) {
  return detailSectionRenderers[section.type] || renderReadonlySection;
}

function renderDetailSection(section, ctx) {
  const Renderer = getDetailSectionRenderer(section);
  return React.createElement(Renderer, { ...ctx, section });
}

export {
  detailSectionRenderers,
  getDetailSectionForColumn,
  getDetailSectionRenderer,
  getDetailSections,
  isSectionVisible,
  renderDetailSection,
};

export default detailSectionRenderers;
