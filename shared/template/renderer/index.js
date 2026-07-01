'use strict';

let ReactRuntime = null;

function createDocumentRendererCore(reactRuntime) {
  if (!reactRuntime || typeof reactRuntime.createElement !== 'function') {
    throw new Error('DocumentRendererCore requires a React runtime with createElement().');
  }
  ReactRuntime = reactRuntime;
  return DocumentRendererCore;
}

function getReactRuntime() {
  if (!ReactRuntime || typeof ReactRuntime.createElement !== 'function') {
    throw new Error('DocumentRendererCore React runtime has not been configured.');
  }
  return ReactRuntime;
}

const BLOCK_TYPES = {
  DOCUMENT_TITLE: 'document_title',
  DOCUMENT_NUMBER: 'document_number',
  DOCUMENT_DATES: 'document_dates',
  COMPANY_IDENTITY: 'company_identity',
  COUNTERPARTY_IDENTITY: 'counterparty_identity',
  ITEMS_TABLE: 'items_table',
  TOTALS_TABLE: 'totals_table',
  PAYMENT: 'payment',
  NOTES: 'notes',
  LEGAL_FOOTER: 'legal_footer',
};

function h(type, props, ...children) {
  return getReactRuntime().createElement(type, props, ...children);
}

function compactClassName(...parts) {
  return parts.filter(Boolean).join(' ');
}

function asNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

function asText(value, fallback = '—') {
  if (Array.isArray(value)) {
    const compact = value
      .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
      .map((item) => String(item));
    return compact.length > 0 ? compact.join('\n') : fallback;
  }
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  return String(value);
}

function asFirstText(value, fallback = '—') {
  if (Array.isArray(value)) {
    const first = value.find(
      (item) => item !== null && item !== undefined && String(item).trim() !== ''
    );
    return first !== undefined ? String(first) : fallback;
  }
  return asText(value, fallback);
}

function parseSegment(segment) {
  if (segment === '*') return { key: '*', index: null };

  const match = /^([^[\]]+)(?:\[(\*|\d+)\])?$/.exec(segment);
  if (!match) return { key: segment, index: null };

  return {
    key: match[1],
    index: match[2] ?? null,
  };
}

function expandSegment(candidates, segmentInfo) {
  const next = [];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;

    if (segmentInfo.key === '*') {
      if (Array.isArray(candidate)) next.push(...candidate);
      continue;
    }

    const sources = Array.isArray(candidate) ? candidate : [candidate];
    for (const source of sources) {
      if (source === null || source === undefined || typeof source !== 'object') continue;
      const resolved = source[segmentInfo.key];

      if (segmentInfo.index === null) {
        next.push(resolved);
        continue;
      }

      if (!Array.isArray(resolved)) continue;
      if (segmentInfo.index === '*') {
        next.push(...resolved);
        continue;
      }

      const index = Number.parseInt(segmentInfo.index, 10);
      if (!Number.isNaN(index)) next.push(resolved[index]);
    }
  }

  return next;
}

function resolvePathCandidates(dataContext, path) {
  if (!path || typeof path !== 'string') return [];

  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => parseSegment(segment));

  if (segments.length === 0) return [];

  let candidates = [dataContext];
  for (const segmentInfo of segments) {
    candidates = expandSegment(candidates, segmentInfo);
    if (candidates.length === 0) return [];
  }

  return candidates.filter((item) => item !== undefined);
}

function normalizeResolvedValue(value) {
  if (!Array.isArray(value)) return value;
  const compact = value.filter((item) => item !== undefined && item !== null);
  if (compact.length === 0) return undefined;
  if (compact.length === 1) return compact[0];
  return compact;
}

function resolveBindingValue({ dataContext, binding, defaultPath, fallback = null } = {}) {
  let path = defaultPath;
  let bindingFallback = fallback;

  if (typeof binding === 'string') {
    path = binding;
  } else if (binding && typeof binding === 'object') {
    if (typeof binding.path === 'string' && binding.path.trim()) {
      path = binding.path.trim();
    }
    if (Object.prototype.hasOwnProperty.call(binding, 'fallback')) {
      bindingFallback = binding.fallback;
    }
  }

  const resolved = normalizeResolvedValue(resolvePathCandidates(dataContext, path));
  if (resolved === undefined || resolved === null || resolved === '') {
    return bindingFallback ?? null;
  }

  return resolved;
}

function getFieldConfig(props, fieldKey) {
  if (!props || typeof props !== 'object') return {};
  const cfg = props.fieldsConfig;
  if (!cfg || typeof cfg !== 'object') return {};
  return cfg[fieldKey] || {};
}

function isFieldEnabled(props, fieldKey, legacyVisible = true) {
  const cfg = getFieldConfig(props, fieldKey);
  if (cfg.enabled === false) return false;
  if (cfg.enabled === true) return true;
  return Boolean(legacyVisible);
}

function getFieldLabel(props, fieldKey, fallbackLabel) {
  const cfg = getFieldConfig(props, fieldKey);
  if (typeof cfg.label === 'string' && cfg.label.trim()) return cfg.label.trim();
  return fallbackLabel;
}

function sortFieldsByConfig(fields, props) {
  if (!Array.isArray(fields) || fields.length === 0) return fields;
  const indexed = fields.map((field, index) => ({ field, index }));
  indexed.sort((left, right) => {
    const leftOrder = getFieldConfig(props, left.field.key).order;
    const rightOrder = getFieldConfig(props, right.field.key).order;
    const normalizedLeft = typeof leftOrder === 'number' ? leftOrder : Infinity;
    const normalizedRight = typeof rightOrder === 'number' ? rightOrder : Infinity;
    return normalizedLeft !== normalizedRight
      ? normalizedLeft - normalizedRight
      : left.index - right.index;
  });
  return indexed.map(({ field }) => field);
}

function formatDate(value) {
  const text = asText(value);
  if (text === '—') return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${day}.${month}.${year}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('pl-PL');
}

function formatNumber(value, fractionDigits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('pl-PL', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function withCurrency(amountText, currency, showCurrency) {
  if (!showCurrency || amountText === '—') return amountText;
  const trimmedCurrency = String(currency || '').trim();
  return trimmedCurrency ? `${amountText} ${trimmedCurrency}` : amountText;
}

function resolveStyleTokens(styleTokens = {}) {
  const fontSizeBase = asNumber(styleTokens.fontSizeBase, 12);
  return {
    '--dtr-font-size-base': `${fontSizeBase}px`,
    '--dtr-text-color': asColor(styleTokens.textColor ?? styleTokens.colorText, '#111827'),
    '--dtr-muted-color': asColor(styleTokens.mutedColor ?? styleTokens.colorMuted, '#64748b'),
    '--dtr-accent-color': asColor(
      styleTokens.accentColor ?? styleTokens.colorAccent ?? styleTokens.colorPrimary,
      '#2563eb'
    ),
    '--dtr-border-color': asColor(styleTokens.borderColor ?? styleTokens.colorBorder, '#e2e8f0'),
  };
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    color: 'var(--dtr-text-color, #111827)',
    fontSize: 'var(--dtr-font-size-base, 12px)',
    lineHeight: 1.45,
    boxSizing: 'border-box',
  },
  emptyState: {
    border: '1px dashed #cbd5e1',
    borderRadius: 6,
    background: '#f8fafc',
    color: 'var(--dtr-muted-color, #64748b)',
    padding: 12,
  },
  section: {
    border: '1px solid transparent',
    borderRadius: 4,
    background: 'transparent',
    padding: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxSizing: 'border-box',
  },
  sectionContent: {
    display: 'flex',
    gap: 10,
    minWidth: 0,
    boxSizing: 'border-box',
  },
  sectionFlow: { flexDirection: 'column' },
  sectionGrid: { flexWrap: 'wrap' },
  sectionFixed: { flexWrap: 'nowrap', overflow: 'auto' },
  block: {
    border: '1px solid transparent',
    borderRadius: 4,
    background: 'transparent',
    padding: 6,
    minWidth: 120,
    flex: '1 1 auto',
    boxSizing: 'border-box',
  },
  unknownBlock: {
    color: '#92400e',
    fontSize: 'calc(var(--dtr-font-size-base, 12px) - 1px)',
    border: '1px dashed #f59e0b',
    borderRadius: 4,
    background: '#fffbeb',
    padding: 8,
  },
  titleBlock: {
    fontSize: 'calc(var(--dtr-font-size-base, 12px) + 6px)',
    lineHeight: 1.3,
    fontWeight: 700,
    color: '#111827',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  denseStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: 'var(--dtr-muted-color, #64748b)',
    fontSize: 'calc(var(--dtr-font-size-base, 12px) - 1px)',
  },
  labelMuted: {
    color: 'var(--dtr-muted-color, #64748b)',
    fontSize: 'calc(var(--dtr-font-size-base, 12px) - 1px)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  value: {
    color: '#111827',
    fontSize: 'var(--dtr-font-size-base, 12px)',
    overflowWrap: 'anywhere',
  },
  valueStrong: {
    color: '#111827',
    fontSize: 'calc(var(--dtr-font-size-base, 12px) + 1px)',
    fontWeight: 600,
  },
  noteText: {
    color: '#111827',
    whiteSpace: 'pre-wrap',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #e2e8f0',
  },
  th: {
    color: '#475569',
    background: '#f8fafc',
    fontSize: 'calc(var(--dtr-font-size-base, 12px) - 1px)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    textAlign: 'left',
    borderBottom: '1px solid #e2e8f0',
    padding: '6px 8px',
    verticalAlign: 'top',
  },
  td: {
    color: '#111827',
    borderBottom: '1px solid #e2e8f0',
    padding: '6px 8px',
    verticalAlign: 'top',
  },
  alignRight: {
    textAlign: 'right',
  },
  emptyTableCell: {
    color: 'var(--dtr-muted-color, #64748b)',
    textAlign: 'center',
  },
};

function blockStyle(layout = {}) {
  const style = {};
  const widthMode = layout?.widthMode || 'auto';
  const widthValue = Number(layout?.widthValue);

  if (widthMode === 'fraction' && Number.isFinite(widthValue) && widthValue > 0) {
    const pct = `${Math.min(widthValue, 1) * 100}%`;
    style.flex = `0 0 ${pct}`;
    style.maxWidth = pct;
    style.minWidth = 0;
  } else if (widthMode === 'fixed' && Number.isFinite(widthValue) && widthValue > 0) {
    style.flex = '0 0 auto';
    style.width = `${widthValue}px`;
  }

  const minWidthPx = Number(layout?.minWidthPx);
  if (Number.isFinite(minWidthPx) && minWidthPx > 0) {
    style.minWidth = `${minWidthPx}px`;
  }

  if (layout?.horizontalAlign === 'center') {
    style.marginInline = 'auto';
  } else if (layout?.horizontalAlign === 'end') {
    style.marginInlineStart = 'auto';
  }

  return style;
}

function renderMetaRow(key, label, value, strong = false) {
  return h(
    'div',
    { key, className: 'dtr-meta-row', style: styles.metaRow },
    h('span', { className: strong ? 'dtr-value-strong' : 'dtr-label', style: strong ? styles.valueStrong : styles.label }, label),
    h('span', { className: strong ? 'dtr-value-strong' : 'dtr-value', style: strong ? styles.valueStrong : styles.value }, value)
  );
}

function renderIdentity({ block, dataContext, target }) {
  const props = block?.props || {};
  const prefix = target === 'company' ? 'company' : 'counterparty';
  const defaults =
    target === 'company'
      ? [
          { key: 'legalName', defaultLabel: 'Sprzedawca' },
          { key: 'address', defaultLabel: 'Adres' },
          { key: 'nip', defaultLabel: 'NIP' },
          { key: 'regon', defaultLabel: 'REGON' },
          { key: 'bankAccount', defaultLabel: 'Rachunek' },
        ]
      : [
          { key: 'legalName', defaultLabel: 'Nabywca' },
          { key: 'address', defaultLabel: 'Adres' },
          { key: 'nip', defaultLabel: 'NIP' },
          { key: 'regon', defaultLabel: 'REGON' },
        ];

  const values = {
    legalName: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.legalName || block?.bindings?.name,
      defaultPath: `${prefix}.legalName`,
      fallback: '—',
    }),
    addressLine1: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.addressLine1,
      defaultPath: `${prefix}.addressLine1`,
    }),
    city: resolveBindingValue({ dataContext, binding: block?.bindings?.city, defaultPath: `${prefix}.city` }),
    postalCode: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.postalCode,
      defaultPath: `${prefix}.postalCode`,
    }),
    country: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.country,
      defaultPath: `${prefix}.country`,
    }),
    nip: resolveBindingValue({ dataContext, binding: block?.bindings?.nip, defaultPath: `${prefix}.nip` }),
    regon: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.regon,
      defaultPath: `${prefix}.regon`,
    }),
    bankAccount: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.bankAccount,
      defaultPath: `${prefix}.bankAccount`,
    }),
  };

  const legacy =
    target === 'company'
      ? {
          legalName: true,
          address: props.showAddress !== false,
          nip: props.showNip !== false,
          regon: props.showRegon !== false,
          bankAccount: props.showBankAccount === true,
        }
      : {
          legalName: true,
          address: props.showAddress !== false,
          nip: props.showNip !== false,
          regon: props.showRegon === true,
        };

  const children = [];
  if (target !== 'company') {
    children.push(
      h('div', { key: 'label', className: 'dtr-label-muted', style: styles.labelMuted }, props.label || 'Nabywca')
    );
  }

  for (const field of sortFieldsByConfig(defaults, props)) {
    if (!isFieldEnabled(props, field.key, legacy[field.key])) continue;

    if (field.key === 'legalName') {
      children.push(
        h('div', { key: 'legalName', className: 'dtr-value-strong', style: styles.valueStrong }, asFirstText(values.legalName))
      );
      continue;
    }

    if (field.key === 'address') {
      const cityLine =
        `${asText(values.postalCode, '').trim()} ${asText(values.city, '').trim()} ${asText(
          values.country,
          ''
        ).trim()}`.trim() || '—';
      children.push(
        h('div', { key: 'addressLine1', className: 'dtr-value', style: styles.value }, asFirstText(values.addressLine1)),
        h('div', { key: 'cityLine', className: 'dtr-value', style: styles.value }, cityLine)
      );
      continue;
    }

    children.push(
      renderMetaRow(
        field.key,
        getFieldLabel(props, field.key, field.defaultLabel),
        asFirstText(values[field.key])
      )
    );
  }

  return h('div', { className: 'dtr-identity-block', style: styles.stack }, ...children);
}

function renderDocumentTitle({ block, dataContext }) {
  const fallback = block?.props?.fallbackLabel || 'DOCUMENT';
  const resolved = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.primary,
    defaultPath: 'document.typeLabel',
    fallback,
  });
  const text = String(Array.isArray(resolved) ? resolved.find(Boolean) ?? fallback : resolved ?? fallback);
  const uppercase = block?.props?.uppercase !== false;
  const align = ['left', 'center', 'right'].includes(block?.props?.align) ? block.props.align : 'left';
  return h(
    'div',
    { className: 'dtr-title-block', style: { ...styles.titleBlock, textAlign: align } },
    uppercase ? text.toUpperCase() : text
  );
}

function renderDocumentNumber({ block, dataContext }) {
  const label = block?.props?.label || 'Nr';
  const showLabel = block?.props?.showLabel !== false;
  const numberValue = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.number || block?.bindings?.primary,
    defaultPath: 'document.number',
    fallback: '—',
  });

  return h(
    'div',
    { className: 'dtr-number-block', style: styles.stack },
    showLabel ? h('span', { className: 'dtr-label', style: styles.label }, label) : null,
    h('span', { className: 'dtr-value', style: styles.value }, asFirstText(numberValue))
  );
}

function renderDocumentDates({ block, dataContext }) {
  const props = block?.props || {};
  const defs = [
    { key: 'issueDate', defaultLabel: 'Data wystawienia' },
    { key: 'saleDate', defaultLabel: 'Data sprzedaży' },
    { key: 'dueDate', defaultLabel: 'Termin płatności' },
  ];
  const values = {
    issueDate: formatDate(resolveBindingValue({ dataContext, binding: block?.bindings?.issueDate, defaultPath: 'document.issueDate' })),
    saleDate: formatDate(resolveBindingValue({ dataContext, binding: block?.bindings?.saleDate, defaultPath: 'document.saleDate' })),
    dueDate: formatDate(resolveBindingValue({ dataContext, binding: block?.bindings?.dueDate, defaultPath: 'payment.dueDate' })),
  };
  const legacy = {
    issueDate: props.showIssueDate !== false,
    saleDate: props.showSaleDate !== false,
    dueDate: props.showDueDate !== false,
  };

  return h(
    'div',
    { className: 'dtr-dates-block', style: styles.stack },
    ...sortFieldsByConfig(defs, props)
      .filter((field) => isFieldEnabled(props, field.key, legacy[field.key]))
      .map((field) => renderMetaRow(field.key, getFieldLabel(props, field.key, field.defaultLabel), values[field.key]))
  );
}

const COLUMN_PRESETS = {
  lp: { key: 'lp', label: 'Lp.', align: 'right' },
  name: { key: 'name', label: 'Nazwa', align: 'left' },
  quantity: { key: 'quantity', label: 'Ilość', align: 'right' },
  unit: { key: 'unit', label: 'JM', align: 'left' },
  unitNetPrice: { key: 'unitNetPrice', label: 'Cena netto', align: 'right', kind: 'money' },
  vatRate: { key: 'vatRate', label: 'VAT', align: 'right', kind: 'vat' },
  netAmount: { key: 'netAmount', label: 'Netto', align: 'right', kind: 'money' },
  vatAmount: { key: 'vatAmount', label: 'VAT', align: 'right', kind: 'money' },
  grossAmount: { key: 'grossAmount', label: 'Brutto', align: 'right', kind: 'money' },
};

const DEFAULT_COLUMNS = [
  'lp',
  'name',
  'quantity',
  'unit',
  'unitNetPrice',
  'vatRate',
  'netAmount',
  'vatAmount',
  'grossAmount',
];

function resolveColumns(props) {
  const rawSource = Array.isArray(props?.columns) && props.columns.length > 0 ? props.columns : DEFAULT_COLUMNS;
  const cols = rawSource
    .map((entry) => {
      if (typeof entry === 'string') return COLUMN_PRESETS[entry] || null;
      if (!entry || typeof entry !== 'object') return null;
      const key = String(entry.key || '').trim();
      if (!key) return null;
      const base = COLUMN_PRESETS[key] || { key, label: key, align: 'left' };
      return {
        ...base,
        label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : base.label,
        align: entry.align === 'right' || entry.align === 'center' ? entry.align : base.align,
        kind: typeof entry.kind === 'string' ? entry.kind : base.kind,
      };
    })
    .filter(Boolean);

  return sortFieldsByConfig(
    cols
      .filter((col) => isFieldEnabled(props, col.key, true))
      .map((col) => ({ ...col, label: getFieldLabel(props, col.key, col.label) })),
    props
  );
}

function formatCell(value, column) {
  if (value === null || value === undefined || value === '') return '—';
  if (column.kind === 'money') return formatNumber(value, 2);
  if (column.kind === 'vat') {
    const text = String(value).trim();
    return text.endsWith('%') ? text : `${text}%`;
  }
  if (column.key === 'quantity') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    if (Number.isInteger(numeric)) return String(numeric);
    return numeric.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }
  return String(value);
}

function renderItemsTable({ block, dataContext }) {
  const props = block?.props || {};
  const columns = resolveColumns(props);
  const rows = Array.isArray(
    resolveBindingValue({ dataContext, binding: block?.bindings?.items, defaultPath: 'items', fallback: [] })
  )
    ? resolveBindingValue({ dataContext, binding: block?.bindings?.items, defaultPath: 'items', fallback: [] }).filter(
        (row) => row && typeof row === 'object'
      )
    : [];

  if (columns.length === 0) {
    return h('div', { className: 'dtr-value', style: styles.value }, 'Brak konfiguracji kolumn.');
  }

  const header =
    props.showHeader === false
      ? null
      : h(
          'thead',
          null,
          h(
            'tr',
            null,
            ...columns.map((column) =>
              h(
                'th',
                {
                  key: column.key,
                  className: column.align === 'right' ? 'dtr-align-right' : undefined,
                  style: column.align === 'right' ? { ...styles.th, ...styles.alignRight } : styles.th,
                },
                column.label
              )
            )
          )
        );

  const bodyRows =
    rows.length === 0
      ? [
          h(
            'tr',
            { key: 'empty' },
            h(
              'td',
              { colSpan: columns.length, className: 'dtr-empty-table-cell', style: { ...styles.td, ...styles.emptyTableCell } },
              'Brak pozycji.'
            )
          ),
        ]
      : rows.map((row, rowIndex) =>
          h(
            'tr',
            { key: row.id || row.key || `item-${rowIndex}` },
            ...columns.map((column) => {
              const value = column.key === 'lp' ? row.lp ?? rowIndex + 1 : row[column.key];
              return h(
                'td',
                {
                  key: column.key,
                  className: column.align === 'right' ? 'dtr-align-right' : undefined,
                  style: column.align === 'right' ? { ...styles.td, ...styles.alignRight } : styles.td,
                },
                formatCell(value, column)
              );
            })
          )
        );

  return h(
    'div',
    { className: 'dtr-items-table-block', style: styles.stack },
    h('table', { className: 'dtr-data-table', style: styles.table }, header, h('tbody', null, ...bodyRows))
  );
}

function renderTotalsTable({ block, dataContext }) {
  const showByVatRate = block?.props?.showByVatRate === true;
  const showCurrency = block?.props?.showCurrency !== false;
  const totals =
    resolveBindingValue({ dataContext, binding: block?.bindings?.totals, defaultPath: 'totals', fallback: {} }) || {};
  const currency =
    resolveBindingValue({ dataContext, binding: block?.bindings?.currency, defaultPath: 'document.currency' }) ||
    totals.currency;
  const byVatRate = Array.isArray(totals.byVatRate)
    ? totals.byVatRate.filter((row) => row && typeof row === 'object')
    : [];
  const children = [];

  if (showByVatRate && byVatRate.length > 0) {
    children.push(
      h(
        'table',
        { key: 'vat-table', className: 'dtr-compact-table', style: styles.table },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { style: styles.th }, 'Stawka VAT'),
            h('th', { className: 'dtr-align-right', style: { ...styles.th, ...styles.alignRight } }, 'Netto'),
            h('th', { className: 'dtr-align-right', style: { ...styles.th, ...styles.alignRight } }, 'VAT'),
            h('th', { className: 'dtr-align-right', style: { ...styles.th, ...styles.alignRight } }, 'Brutto')
          )
        ),
        h(
          'tbody',
          null,
          ...byVatRate.map((row, index) =>
            h(
              'tr',
              { key: row.rate || `vat-${index}` },
              h('td', { style: styles.td }, asText(row.rate)),
              h('td', { className: 'dtr-align-right', style: { ...styles.td, ...styles.alignRight } }, withCurrency(formatNumber(row.net), currency, showCurrency)),
              h('td', { className: 'dtr-align-right', style: { ...styles.td, ...styles.alignRight } }, withCurrency(formatNumber(row.vat), currency, showCurrency)),
              h('td', { className: 'dtr-align-right', style: { ...styles.td, ...styles.alignRight } }, withCurrency(formatNumber(row.gross), currency, showCurrency))
            )
          )
        )
      )
    );
  }

  children.push(
    h(
      'div',
      { key: 'rows', className: 'dtr-totals-rows', style: styles.denseStack },
      renderMetaRow('net', 'Razem netto', withCurrency(formatNumber(totals.net), currency, showCurrency)),
      renderMetaRow('vat', 'Razem VAT', withCurrency(formatNumber(totals.vat), currency, showCurrency)),
      renderMetaRow('gross', 'Do zapłaty', withCurrency(formatNumber(totals.gross), currency, showCurrency), true)
    )
  );

  return h('div', { className: 'dtr-totals-block', style: styles.stack }, ...children);
}

function renderPayment({ block, dataContext }) {
  const props = block?.props || {};
  const defs = [
    { key: 'method', defaultLabel: 'Forma płatności' },
    { key: 'dueDate', defaultLabel: 'Termin płatności' },
    { key: 'daysNet', defaultLabel: 'Warunki' },
    { key: 'bankAccount', defaultLabel: 'Rachunek' },
    { key: 'bankName', defaultLabel: 'Bank' },
  ];
  const daysNetRaw = resolveBindingValue({ dataContext, binding: block?.bindings?.daysNet, defaultPath: 'payment.daysNet' });
  const daysNet = asNumber(daysNetRaw, 0);
  const values = {
    method: asText(
      resolveBindingValue({ dataContext, binding: block?.bindings?.methodLabel, defaultPath: 'payment.methodLabel' }) ||
        resolveBindingValue({ dataContext, binding: block?.bindings?.method, defaultPath: 'payment.method' })
    ),
    dueDate: formatDate(resolveBindingValue({ dataContext, binding: block?.bindings?.dueDate, defaultPath: 'payment.dueDate' })),
    daysNet: daysNet > 0 ? `${Math.round(daysNet)} dni` : '—',
    bankAccount: asText(
      resolveBindingValue({
        dataContext,
        binding: block?.bindings?.bankAccount,
        defaultPath: 'payment.bankAccount',
        fallback: resolveBindingValue({
          dataContext,
          binding: block?.bindings?.companyBankAccount,
          defaultPath: 'company.bankAccount',
        }),
      })
    ),
    bankName: asText(
      resolveBindingValue({
        dataContext,
        binding: block?.bindings?.bankName,
        defaultPath: 'payment.bankName',
        fallback: resolveBindingValue({
          dataContext,
          binding: block?.bindings?.companyBankName,
          defaultPath: 'company.bankName',
        }),
      })
    ),
  };
  const legacy = {
    method: props.showMethod !== false,
    dueDate: props.showDueDate !== false,
    daysNet: props.showDaysNet !== false,
    bankAccount: props.showBankAccount !== false,
    bankName: props.showBankName !== false,
  };

  return h(
    'div',
    { className: 'dtr-payment-block', style: styles.stack },
    ...sortFieldsByConfig(defs, props)
      .filter((field) => isFieldEnabled(props, field.key, legacy[field.key]))
      .map((field) => renderMetaRow(field.key, getFieldLabel(props, field.key, field.defaultLabel), values[field.key]))
  );
}

function renderNotes({ block, dataContext }) {
  const label = block?.props?.label || 'Uwagi';
  const notes = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.primary || block?.bindings?.notes,
    defaultPath: 'document.notes',
    fallback: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.secondary || block?.bindings?.privateNotes,
      defaultPath: 'document.privateNotes',
      fallback: '—',
    }),
  });
  return h(
    'div',
    { className: 'dtr-notes-block', style: styles.stack },
    h('div', { className: 'dtr-label-muted', style: styles.labelMuted }, label),
    h('div', { className: 'dtr-note-text', style: styles.noteText }, asText(notes))
  );
}

function renderLegalFooter({ block, dataContext }) {
  const showKsefReference = block?.props?.showKsefReference !== false;
  const children = [
    h(
      'div',
      { key: 'generated', className: 'dtr-value', style: styles.value },
      'Dokument wygenerowany na podstawie aktywnego szablonu.'
    ),
  ];

  if (showKsefReference) {
    children.push(
      h(
        'div',
        { key: 'ksef', className: 'dtr-dense-list', style: styles.denseStack },
        renderMetaRow(
          'ksefNumber',
          'KSeF',
          asText(resolveBindingValue({ dataContext, binding: block?.bindings?.ksefNumber, defaultPath: 'document.ksefNumber' }))
        ),
        renderMetaRow(
          'ksefDate',
          'Data KSeF',
          asText(resolveBindingValue({ dataContext, binding: block?.bindings?.ksefDate, defaultPath: 'document.ksefDate' }))
        )
      )
    );
  }

  return h('div', { className: 'dtr-legal-block', style: styles.stack }, ...children);
}

function renderBlockContent({ block, dataContext }) {
  const blockType = String(block?.type || '').trim();
  switch (blockType) {
    case BLOCK_TYPES.DOCUMENT_TITLE:
      return renderDocumentTitle({ block, dataContext });
    case BLOCK_TYPES.DOCUMENT_NUMBER:
      return renderDocumentNumber({ block, dataContext });
    case BLOCK_TYPES.DOCUMENT_DATES:
      return renderDocumentDates({ block, dataContext });
    case BLOCK_TYPES.COMPANY_IDENTITY:
      return renderIdentity({ block, dataContext, target: 'company' });
    case BLOCK_TYPES.COUNTERPARTY_IDENTITY:
      return renderIdentity({ block, dataContext, target: 'counterparty' });
    case BLOCK_TYPES.ITEMS_TABLE:
      return renderItemsTable({ block, dataContext });
    case BLOCK_TYPES.TOTALS_TABLE:
      return renderTotalsTable({ block, dataContext });
    case BLOCK_TYPES.PAYMENT:
      return renderPayment({ block, dataContext });
    case BLOCK_TYPES.NOTES:
      return renderNotes({ block, dataContext });
    case BLOCK_TYPES.LEGAL_FOOTER:
      return renderLegalFooter({ block, dataContext });
    default:
      return h(
        'div',
        { className: 'dtr-unknown-block', style: styles.unknownBlock },
        h('strong', null, 'Unsupported block:'),
        ` ${blockType || 'unknown'}`
      );
  }
}

function renderBlock({ block, dataContext, sectionKey, index }) {
  const blockType = String(block?.type || '').trim();
  return h(
    'div',
    {
      key: block?.key || `${sectionKey || 'section'}-block-${index}`,
      className: 'dtr-block',
      style: { ...styles.block, ...blockStyle(block?.layout) },
      'data-block-key': block?.key ?? '',
      'data-block-type': blockType || 'unknown',
    },
    renderBlockContent({ block, dataContext })
  );
}

function renderSection({ section, dataContext }) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  const layoutMode = section?.layoutMode || 'flow';
  const contentStyle = {
    ...styles.sectionContent,
    ...(layoutMode === 'grid'
      ? styles.sectionGrid
      : layoutMode === 'fixed'
        ? styles.sectionFixed
        : styles.sectionFlow),
  };

  return h(
    'section',
    {
      key: section?.key || `section-${section?.order ?? ''}`,
      className: compactClassName('dtr-section', `dtr-section-${layoutMode}`),
      style: styles.section,
      'data-section-key': section?.key || '',
      'data-layout-mode': layoutMode,
    },
    h(
      'div',
      { className: 'dtr-section-content', style: contentStyle },
      ...blocks.map((block, index) => renderBlock({ block, dataContext, sectionKey: section?.key, index }))
    )
  );
}

function getSections(templateDraft, isEditorInteractive) {
  const sections = Array.isArray(templateDraft?.sections) ? templateDraft.sections : [];
  return sections
    .filter((section) => section && (isEditorInteractive || section.enabled !== false))
    .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));
}

function normalizeRenderContext(renderContext = {}) {
  return {
    mode: renderContext?.mode || 'editor_preview',
    channel: renderContext?.channel || 'editor',
    locale: renderContext?.locale || 'pl',
    isEditorInteractive: renderContext?.isEditorInteractive === true,
  };
}

function DocumentRendererCore({ templateDraft, dataContext, renderContext }) {
  const normalizedContext = normalizeRenderContext(renderContext);

  if (!templateDraft) {
    return h('div', { className: 'dtr-empty-state', style: styles.emptyState }, 'No template draft loaded.');
  }

  const sections = getSections(templateDraft, normalizedContext.isEditorInteractive);
  const styleVars = resolveStyleTokens(templateDraft?.styleTokens || {});

  if (sections.length === 0) {
    return h(
      'article',
      { className: 'dtr-root', style: { ...styles.root, ...styleVars } },
      h('div', { className: 'dtr-empty-state', style: styles.emptyState }, 'Template has no enabled sections.')
    );
  }

  return h(
    'article',
    {
      className: 'dtr-root',
      style: { ...styles.root, ...styleVars },
      'data-document-type': templateDraft?.documentTypeKey || '',
      'data-render-mode': normalizedContext.mode,
      'data-render-channel': normalizedContext.channel,
      'data-render-locale': normalizedContext.locale,
    },
    ...sections.map((section) => renderSection({ section, dataContext }))
  );
}

function getRendererCss() {
  return `
.dtr-root, .dtr-root * { box-sizing: border-box; }
.dtr-data-table tr:last-child td, .dtr-compact-table tr:last-child td { border-bottom: 0 !important; }
@media print {
  .dtr-root { color: #111827 !important; }
  .dtr-section, .dtr-block { break-inside: avoid; }
  .dtr-data-table thead, .dtr-compact-table thead { display: table-header-group; }
}
`;
}

module.exports = {
  DocumentRendererCore,
  createDocumentRendererCore,
  getRendererCss,
  resolveBindingValue,
  resolveStyleTokens,
};
