import {
  asNumber,
  asText,
  getQtyField,
  isRowEmpty,
} from './rowControllerModel.js';

function getRuleKey(rule = {}) {
  return asText(rule.key || rule.id);
}

function resolveField(rule = {}, config = {}, qtyField = '') {
  const field = asText(rule.field);
  if (field === '$qtyField') return qtyField || getQtyField(config);
  return field;
}

function getMessage(rule = {}, field = '') {
  if (rule.fallback) return rule.fallback;
  if (field === 'warehouseId') return 'Warehouse is required';
  if (field === 'fromWarehouseId') return 'From warehouse is required';
  if (field === 'toWarehouseId') return 'To warehouse is required';
  if (field === 'documentType') return 'Type is required';
  if (field === 'reason') return 'Reason is required';
  if (field === 'productId') return 'Product is required';
  if (rule.rule === 'numberGreaterThan') return 'Qty must be greater than 0';
  if (rule.rule === 'hasPersistableRows') return 'Add at least one product row before saving.';
  return rule.messageKey || getRuleKey(rule) || 'Validation failed';
}

function pushIssue(result, issue) {
  const bucket = issue.level === 'warning' ? result.warnings : result.blocking;
  bucket.push(issue);

  if (issue.scope === 'header' || issue.scope === 'field') {
    result.byField[issue.field] = issue.message;
    return;
  }

  if (issue.scope === 'document') {
    const levelKey = issue.level === 'warning' ? 'warnings' : 'blocking';
    result.byDocument[levelKey].push(issue);
    return;
  }

  if (issue.scope === 'row') {
    if (!result.byRow[issue.rowId]) {
      result.byRow[issue.rowId] = { blocking: {}, warnings: {} };
    }
    const levelKey = issue.level === 'warning' ? 'warnings' : 'blocking';
    result.byRow[issue.rowId][levelKey][issue.field] = issue.message;
  }
}

function shouldTriggerHeaderRule(rule, header, field) {
  if (rule.rule === 'required') return !asText(header?.[field]);
  return false;
}

function shouldTriggerDocumentRule(rule, ctx) {
  if (rule.rule === 'hasPersistableRows') {
    return !Array.isArray(ctx.persistableRows) || ctx.persistableRows.length === 0;
  }
  return false;
}

function shouldTriggerRowRule(rule, row, field) {
  if (rule.rule === 'required') return !asText(row?.[field]);
  if (rule.rule === 'requiredWhenRowIsNotEmpty') return !asText(row?.[field]);
  if (rule.rule === 'numberGreaterThan') return asNumber(row?.[field], 0) <= asNumber(rule.value, 0);
  if (rule.rule === 'missingOrManualCostSource') return asText(row?.productId) && !asText(row?.[field]);
  if (rule.rule === 'requiredWhenProductFlag') {
    return asText(row?.productId) && Boolean(row?.[rule.productFlag]) && !asText(row?.[field]);
  }
  return false;
}

function makeIssue(rule, { field = '', rowId = '', scope = rule.scope } = {}) {
  return {
    key: getRuleKey(rule),
    level: rule.level === 'warning' ? 'warning' : 'blocking',
    scope,
    field,
    rowId,
    message: getMessage(rule, field),
    messageKey: rule.messageKey || '',
  };
}

function runValidationRules(config = {}, ctx = {}) {
  const qtyField = ctx.qtyField || getQtyField(config);
  const rules = Array.isArray(config.validation) ? config.validation : [];
  const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
  const result = {
    blocking: [],
    warnings: [],
    byRow: {},
    byField: {},
    byDocument: { blocking: [], warnings: [] },
  };

  rules.forEach((rule) => {
    const field = resolveField(rule, config, qtyField);

    if (rule.scope === 'document') {
      if (shouldTriggerDocumentRule(rule, ctx)) {
        pushIssue(result, makeIssue(rule, { field, scope: 'document' }));
      }
      return;
    }

    if (rule.scope === 'header' || rule.scope === 'field') {
      if (shouldTriggerHeaderRule(rule, ctx.header || {}, field)) {
        pushIssue(result, makeIssue(rule, { field, scope: rule.scope }));
      }
      return;
    }

    if (rule.scope !== 'row') return;

    rows.forEach((row) => {
      if (isRowEmpty(row, config)) return;
      if (!shouldTriggerRowRule(rule, row, field)) return;
      pushIssue(result, makeIssue(rule, {
        field,
        rowId: asText(row?.localId || row?.id),
        scope: 'row',
      }));
    });
  });

  return result;
}

export {
  runValidationRules,
};

export default runValidationRules;
