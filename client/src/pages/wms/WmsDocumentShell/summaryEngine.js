import {
  asNumber,
  getPersistableRows,
  getQtyField,
  round4,
} from './rowControllerModel.js';

function sumRows(rows, getter) {
  return rows.reduce((acc, row) => acc + getter(row), 0);
}

function parseSumProductFields(source = '') {
  const match = String(source).match(/^sum\(([^*]+)\*([^*]+)\)$/);
  if (!match) return null;
  return {
    left: match[1].trim(),
    right: match[2].trim(),
  };
}

function resolveSourceField(field, ctx) {
  if (field === '$qtyField') return ctx.qtyField || getQtyField(ctx.config);
  return field;
}

function computeSummaryValue(key, source, rows, ctx) {
  const qtyField = ctx.qtyField || getQtyField(ctx.config);
  const sumProductFields = parseSumProductFields(source);

  if (key === 'lines' || source === 'persistableRows.length') return rows.length;
  if (key === 'totalQty' || source === 'sum($qtyField)' || source === `sum(${qtyField})`) {
    return round4(sumRows(rows, (row) => asNumber(row?.[qtyField], 0)));
  }
  if (sumProductFields) {
    const left = resolveSourceField(sumProductFields.left, ctx);
    const right = resolveSourceField(sumProductFields.right, ctx);
    return round4(sumRows(rows, (row) => asNumber(row?.[left], 0) * asNumber(row?.[right], 0)));
  }
  if (key === 'warningCount' || source === 'rowWarnings.length') return ctx.warningCount || 0;
  if (key === 'blockingCount' || source === 'rowErrors.length') return ctx.blockingCount || 0;

  return 0;
}

function computeSummary(config = {}, ctx = {}) {
  const rows = Array.isArray(ctx.persistableRows)
    ? ctx.persistableRows
    : getPersistableRows(Array.isArray(ctx.rows) ? ctx.rows : [], config);
  const summaryFields = Array.isArray(config.summary) ? config.summary : [];
  const next = {};
  const valueCtx = {
    ...ctx,
    config,
    qtyField: ctx.qtyField || getQtyField(config),
  };

  summaryFields.forEach((field) => {
    next[field.key] = computeSummaryValue(field.key, field.source, rows, valueCtx);
  });

  if (next.lines === undefined) next.lines = rows.length;
  if (next.totalQty === undefined) {
    next.totalQty = round4(sumRows(rows, (row) => asNumber(row?.[valueCtx.qtyField], 0)));
  }
  if (next.warningCount === undefined) next.warningCount = ctx.warningCount || 0;
  if (next.blockingCount === undefined) next.blockingCount = ctx.blockingCount || 0;

  return next;
}

export {
  computeSummary,
};

export default computeSummary;
