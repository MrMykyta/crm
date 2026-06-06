'use strict';

// Dynamic placeholders resolver (Phase 1 / spec §9).
//
// Walks the filter JSON and substitutes any leaf string value that exactly equals one of the
// supported placeholders with its resolved runtime value. Returns a new object (does not
// mutate the input). Unknown placeholders are kept as-is (best-effort policy: better to keep
// an invisible string than to corrupt a saved view).
//
// MVP-supported placeholders:
//   $current_user             → userId from context
//   $today_start              → ISO timestamp at user's TZ midnight (today)
//   $today_end                → ISO timestamp at user's TZ midnight (tomorrow)
//   $user_default_warehouse   → companyWarehouseDocumentSettings.defaultWarehouseId or null
//
// `$user_default_warehouse` is the only async resolver — it needs a DB lookup. To keep the
// resolver synchronous, the caller pre-fetches the default warehouseId and passes it in
// `context.defaultWarehouseId`. Service code is responsible for that lookup.

const PLACEHOLDERS = Object.freeze([
  '$current_user',
  '$today_start',
  '$today_end',
  '$user_default_warehouse',
]);

function isPlaceholder(value) {
  return typeof value === 'string' && value.length > 1 && value[0] === '$';
}

function dayBoundsUTC(now = new Date()) {
  // MVP: server-side UTC midnight. User-timezone variant is a v2 extension once we wire
  // timezone into the user profile.
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function resolvePlaceholder(value, context = {}) {
  if (!isPlaceholder(value)) return value;
  switch (value) {
    case '$current_user':
      return context.userId ?? null;
    case '$today_start':
      return context.todayStart || dayBoundsUTC(context.now).start;
    case '$today_end':
      return context.todayEnd || dayBoundsUTC(context.now).end;
    case '$user_default_warehouse':
      return context.defaultWarehouseId ?? null;
    default:
      return value; // unknown placeholder → keep as-is (best-effort)
  }
}

function walkAndResolve(node, context) {
  if (Array.isArray(node)) {
    return node.map((item) => walkAndResolve(item, context));
  }
  if (node !== null && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = walkAndResolve(v, context);
    }
    return out;
  }
  return resolvePlaceholder(node, context);
}

function resolveFilter(filter, context = {}) {
  if (filter === null || filter === undefined) return filter;
  return walkAndResolve(filter, context);
}

module.exports = {
  resolveFilter,
  resolvePlaceholder,
  PLACEHOLDERS,
};
