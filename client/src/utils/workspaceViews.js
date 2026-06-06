// Workspace Views — pure frontend selectors / helpers (spec §15).
//
// All functions take a `views` array as returned by GET /api/workspace-views
// (`response.data`), where each view has shape:
//   { id, scope: 'system'|'personal', key, isDefault, ownerUserId, prefs: { pinned, hidden, sortOrder, lastUsedAt }, ... }
//
// Functions are pure: same input -> same output, no side effects.

// resolveActiveView — implements §5 + §13.1 resolution order:
//   1) viewId (UUID) — wins over key
//   2) viewKey (string) — must match scope='system'
//   3) default system view
//   4) null (caller decides how to render an empty state)
export function resolveActiveView(views, urlViewId, urlViewKey) {
  if (!Array.isArray(views) || views.length === 0) return null;

  if (urlViewId) {
    const byId = views.find((v) => v.id === urlViewId);
    if (byId) return byId;
  }

  if (urlViewKey) {
    const byKey = views.find((v) => v.scope === 'system' && v.key === urlViewKey);
    if (byKey) return byKey;
  }

  return resolveDefaultView(views);
}

// resolveDefaultView — view with isDefault=true. Falls back to the first system view,
// then to any view at all, so we never strand the picker on an empty selection.
export function resolveDefaultView(views) {
  if (!Array.isArray(views) || views.length === 0) return null;
  const explicit = views.find((v) => v.isDefault);
  if (explicit) return explicit;
  const anySystem = views.find((v) => v.scope === 'system');
  if (anySystem) return anySystem;
  return views[0] || null;
}

// groupViewsForSidebar — pinned-first slice for the sidebar pinned-views section.
// `max` defaults to 5 per spec §6. `rest` is the spillover used to compute "+N more";
// it is **not** rendered in MVP but exposed for future surfaces (e.g. collapsed flyout).
export function groupViewsForSidebar(views, { max = 5 } = {}) {
  if (!Array.isArray(views)) return { pinned: [], rest: [], overflowCount: 0 };

  const visible = views.filter((v) => !v?.prefs?.hidden);
  const pinned = visible
    .filter((v) => v?.prefs?.pinned)
    .slice()
    .sort(comparePinnedForSidebar);

  if (pinned.length <= max) {
    return { pinned, rest: [], overflowCount: 0 };
  }
  return {
    pinned: pinned.slice(0, max),
    rest: pinned.slice(max),
    overflowCount: pinned.length - max,
  };
}

// groupViewsForPicker — decides tabs-vs-dropdown and returns items in display order.
// Sort rule (spec §7): pinned first (by sortOrder asc), then by lastUsedAt desc, then
// alphabetically. Hidden views are excluded — the picker is the visible-views surface.
export function groupViewsForPicker(views, { tabsThreshold = 6 } = {}) {
  if (!Array.isArray(views)) {
    return { mode: 'tabs', items: [] };
  }

  const items = views
    .filter((v) => !v?.prefs?.hidden)
    .slice()
    .sort(comparePickerItems);

  const mode = items.length <= tabsThreshold ? 'tabs' : 'dropdown';
  return { mode, items };
}

function comparePinnedForSidebar(a, b) {
  const sa = numericOrInf(a?.prefs?.sortOrder);
  const sb = numericOrInf(b?.prefs?.sortOrder);
  if (sa !== sb) return sa - sb;
  return localeCompareName(a, b);
}

function comparePickerItems(a, b) {
  const pa = a?.prefs?.pinned ? 0 : 1;
  const pb = b?.prefs?.pinned ? 0 : 1;
  if (pa !== pb) return pa - pb;

  if (pa === 0) {
    const sa = numericOrInf(a?.prefs?.sortOrder);
    const sb = numericOrInf(b?.prefs?.sortOrder);
    if (sa !== sb) return sa - sb;
  }

  const la = parseTimestamp(a?.prefs?.lastUsedAt);
  const lb = parseTimestamp(b?.prefs?.lastUsedAt);
  if (la !== lb) return lb - la;

  return localeCompareName(a, b);
}

function numericOrInf(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function parseTimestamp(v) {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function localeCompareName(a, b) {
  const an = String(a?.name || '');
  const bn = String(b?.name || '');
  return an.localeCompare(bn);
}

// buildViewUrl — central URL construction so picker / sidebar / page agree.
// System: ?view=<key>; personal: ?viewId=<uuid>. Returns the full path string ready
// for <Link to=...> / navigate().
export function buildViewUrl(routeBase, view, extraSearch) {
  if (!view) return routeBase;
  const sp = new URLSearchParams();
  if (view.scope === 'system' && view.key) {
    sp.set('view', view.key);
  } else if (view.id) {
    sp.set('viewId', view.id);
  }
  if (extraSearch && typeof extraSearch === 'object') {
    for (const [k, v] of Object.entries(extraSearch)) {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `${routeBase}?${qs}` : routeBase;
}
