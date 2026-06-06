// wms.documents — translate a saved view's `filter` JSON into the query-string args
// understood by useListWarehouseDocumentsQuery.
//
// Backend `filter` shape (see systemViewsRegistry/wms.documents.js):
//   { where: [{ field, op, value }, ...] }
//
// Recognised (field, op) pairs in Phase 2:
//   ('type',        'in', ['PZ','WZ',...])  → { type: 'PZ,WZ,...' }
//   ('type',        'eq', 'PZ')             → { type: 'PZ' }
//   ('status',      'in'|'eq', ...)         → { status }
//   ('warehouseId', 'eq', '<uuid>')         → { warehouseId }
//   ('date',        'gte', ISO|$today_start)→ { dateFrom }
//   ('date',        'lt'|'lte', ISO|$today_end) → { dateTo }
//   ('search'|'q',  'eq', string)           → { search }
//
// Empty `filter` (e.g. system `all`) → returns {}. Unknown clauses are dropped with a
// console.warn (graceful fallback — never throw on unrecognised shapes).

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function todayBoundsUtc() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function resolvePlaceholderDate(value) {
  if (value === '$today_start') return todayBoundsUtc().start;
  if (value === '$today_end' || value === '$today_lt') return todayBoundsUtc().end;
  return value;
}

const VALID_TYPES = new Set(['PZ', 'WZ', 'MM', 'RW', 'PW', 'PZK', 'WZK']);

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

export function mapWmsDocumentsFilter(filter) {
  if (!isPlainObject(filter)) return {};
  const where = Array.isArray(filter.where) ? filter.where : null;
  if (!where || where.length === 0) return {};

  const out = {};
  const unknown = [];
  // Collect type values across multiple clauses (defensive — usually one clause).
  const typesAccum = [];

  for (const clause of where) {
    if (!isPlainObject(clause)) { unknown.push(clause); continue; }
    const field = String(clause.field || '');
    const op = String(clause.op || '');
    const value = clause.value;

    switch (field) {
      case 'type': {
        const list = (op === 'in' ? asArray(value) : op === 'eq' ? [value] : null);
        if (!list) { unknown.push(clause); break; }
        for (const v of list) {
          const up = String(v).toUpperCase();
          if (VALID_TYPES.has(up) && !typesAccum.includes(up)) typesAccum.push(up);
        }
        break;
      }
      case 'status': {
        if (op === 'eq' && typeof value === 'string') {
          out.status = value;
        } else if (op === 'in' && Array.isArray(value) && value.length === 1) {
          out.status = String(value[0]);
        } else {
          unknown.push(clause);
        }
        break;
      }
      case 'warehouseId': {
        if (op === 'eq' && typeof value === 'string') {
          out.warehouseId = value;
        } else {
          unknown.push(clause);
        }
        break;
      }
      case 'date': {
        if (op === 'gte') out.dateFrom = resolvePlaceholderDate(value);
        else if (op === 'lt' || op === 'lte') out.dateTo = resolvePlaceholderDate(value);
        else unknown.push(clause);
        break;
      }
      case 'search':
      case 'q': {
        if (op === 'eq' && typeof value === 'string') out.search = value;
        else unknown.push(clause);
        break;
      }
      default:
        unknown.push(clause);
        break;
    }
  }

  if (typesAccum.length > 0) out.type = typesAccum.join(',');

  if (unknown.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[workspaceViews] wms.documents: ignoring unsupported filter clauses', unknown);
  }

  return out;
}

// buildWmsDocumentsFilterFromUrl — inverse of mapWmsDocumentsFilter. Reads the URL
// query state (the same params that the page uses to drive useListWarehouseDocumentsQuery)
// and produces the `{ where: [...] }` shape the backend stores for `filter` JSONB.
//
// Empty values are skipped (we never write empty clauses). Date placeholders are not
// substituted here — the saved value is the literal user input, so re-applying the view
// re-applies the same hard timestamps (not "rolling today"). Rolling windows belong to
// system-view placeholders ($today_start/$today_end), not user-typed filters.
//
// Accepts URLSearchParams, plain object (key→string), or null/undefined → returns
// the canonical empty filter `{ where: [] }`.
export function buildWmsDocumentsFilterFromUrl(searchParams) {
  const get = (key) => {
    if (!searchParams) return null;
    if (typeof searchParams.get === 'function') return searchParams.get(key);
    if (typeof searchParams === 'object') return searchParams[key];
    return null;
  };
  return buildWmsDocumentsFilterFromState({
    search: get('q') ?? get('search'),
    type: get('type'),
    status: get('status'),
    warehouseId: get('warehouseId'),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
  });
}

// buildWmsDocumentsFilterFromState — same as buildWmsDocumentsFilterFromUrl but works
// off a flat state object. Useful when the page already has filter values in a hook
// state instead of (or in addition to) URL search params.
export function buildWmsDocumentsFilterFromState(filters = {}) {
  const where = [];

  const search = (filters.search ?? filters.q ?? '').toString().trim();
  if (search) {
    where.push({ field: 'search', op: 'eq', value: search });
  }

  if (filters.type) {
    // Accept comma-separated string ("WZ,PZ") or array (["WZ","PZ"]).
    const raw = Array.isArray(filters.type)
      ? filters.type
      : String(filters.type).split(',');
    const types = raw
      .map((v) => String(v).trim().toUpperCase())
      .filter(Boolean)
      .filter((t) => VALID_TYPES.has(t));
    if (types.length > 0) {
      where.push({ field: 'type', op: 'in', value: Array.from(new Set(types)) });
    }
  }

  const status = (filters.status ?? '').toString().trim();
  if (status) {
    where.push({ field: 'status', op: 'eq', value: status });
  }

  const warehouseId = (filters.warehouseId ?? '').toString().trim();
  if (warehouseId) {
    where.push({ field: 'warehouseId', op: 'eq', value: warehouseId });
  }

  const dateFrom = (filters.dateFrom ?? '').toString().trim();
  if (dateFrom) {
    where.push({ field: 'date', op: 'gte', value: dateFrom });
  }

  const dateTo = (filters.dateTo ?? '').toString().trim();
  if (dateTo) {
    // Backend wms/documents endpoint uses inclusive `<=` for dateTo (warehouseDocumentsService.js).
    // Store as `lte` so the round-trip preserves user intent.
    where.push({ field: 'date', op: 'lte', value: dateTo });
  }

  return { where };
}

// describeFilterClauses — turns a filter's where[] into rows for the read-only chips
// preview in the editor. Returns [{ key, labelKey, fallback, value }]. Unknown clauses
// are emitted as { key, label: clause.field, value: JSON } so nothing is silently lost
// from the user's view, even when the schema gets ahead of this helper.
export function describeFilterClauses(filter) {
  if (!isPlainObject(filter)) return [];
  const where = Array.isArray(filter.where) ? filter.where : [];
  return where.map((clause, idx) => {
    if (!isPlainObject(clause)) {
      return { key: `unknown-${idx}`, label: 'Unknown', value: JSON.stringify(clause) };
    }
    const value = Array.isArray(clause.value) ? clause.value.join(', ') : String(clause.value ?? '');
    switch (clause.field) {
      case 'type':
        return { key: `type-${idx}`, labelKey: 'workspaceViews.editor.type', fallback: 'Type', value };
      case 'status':
        return { key: `status-${idx}`, labelKey: 'workspaceViews.editor.status', fallback: 'Status', value };
      case 'warehouseId':
        return { key: `warehouse-${idx}`, labelKey: 'workspaceViews.editor.warehouse', fallback: 'Warehouse', value };
      case 'search':
      case 'q':
        return { key: `search-${idx}`, labelKey: 'workspaceViews.editor.search', fallback: 'Search', value };
      case 'date': {
        const isFrom = clause.op === 'gte' || clause.op === 'gt';
        return {
          key: `date-${idx}`,
          labelKey: isFrom ? 'workspaceViews.editor.dateFrom' : 'workspaceViews.editor.dateTo',
          fallback: isFrom ? 'Date from' : 'Date to',
          value,
        };
      }
      default:
        return { key: `${clause.field}-${idx}`, label: String(clause.field || 'unknown'), value };
    }
  });
}
