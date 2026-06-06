'use strict';

// Workspace Views service — Phase 1 backend foundation.
// Spec: WORKSPACE_VIEWS_MVP_SPEC.md §11-§12.
//
// Scope: only `system` + `personal` views; cross-user sharing is post-MVP.
// Personal-view hard-limit per (user, module): 50.

const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const {
  WorkspaceView,
  WorkspaceViewUserPref,
} = require('../../models');
const { isKnownModule, getSystemViewsFor } = require('./systemViewsRegistry');

const PERSONAL_VIEW_LIMIT = 50;
const SCOPE_SYSTEM = 'system';
const SCOPE_PERSONAL = 'personal';

// ----------------------------------------------------------------------------
// Common guards
// ----------------------------------------------------------------------------

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

function ensureUserId(userId) {
  if (!userId) {
    throw new AppError(401, 'User context required', { code: 'AUTH_REQUIRED' });
  }
}

function ensureKnownModule(module) {
  if (!module || typeof module !== 'string') {
    throw new AppError(400, 'module is required', { code: 'VALIDATION_ERROR' });
  }
  if (!isKnownModule(module)) {
    throw new AppError(409, `Unknown module "${module}"`, {
      code: 'UNKNOWN_MODULE',
      details: { module },
    });
  }
}

function asText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

// ----------------------------------------------------------------------------
// DTOs
// ----------------------------------------------------------------------------

function viewToDto(view, prefs = null) {
  const v = view.get ? view.get({ plain: true }) : view;
  const p = prefs && prefs.get ? prefs.get({ plain: true }) : prefs;
  return {
    id: v.id,
    module: v.module,
    key: v.key || null,
    scope: v.scope,
    name: v.name,
    nameI18nKey: v.nameI18nKey || null,
    description: v.description || null,
    icon: v.icon || null,
    filter: v.filter || {},
    sort: v.sort || null,
    columns: v.columns || null,
    viewType: v.viewType || 'list',
    isDefault: Boolean(v.isDefault),
    isLocked: Boolean(v.isLocked),
    ownerUserId: v.ownerUserId || null,
    prefs: p
      ? {
        pinned: Boolean(p.pinned),
        hidden: Boolean(p.hidden),
        sortOrder: Number(p.sortOrder) || 0,
        lastUsedAt: p.lastUsedAt || null,
      }
      : {
        pinned: false,
        hidden: false,
        sortOrder: 0,
        lastUsedAt: null,
      },
    createdAt: v.createdAt || null,
    updatedAt: v.updatedAt || null,
  };
}

function prefsToDto(prefsRow) {
  if (!prefsRow) {
    return { pinned: false, hidden: false, sortOrder: 0, lastUsedAt: null };
  }
  const p = prefsRow.get ? prefsRow.get({ plain: true }) : prefsRow;
  return {
    pinned: Boolean(p.pinned),
    hidden: Boolean(p.hidden),
    sortOrder: Number(p.sortOrder) || 0,
    lastUsedAt: p.lastUsedAt || null,
  };
}

// ----------------------------------------------------------------------------
// ensureSystemViewsForCompany — idempotent lazy seed
// ----------------------------------------------------------------------------

async function ensureSystemViewsForCompany(companyId, module, { transaction = null } = {}) {
  ensureCompanyId(companyId);
  ensureKnownModule(module);

  const descriptors = getSystemViewsFor(module);
  if (descriptors.length === 0) return { created: 0, ensured: 0 };

  let created = 0;
  let ensured = 0;

  for (const d of descriptors) {
    if (!d.key) continue;
    // eslint-disable-next-line no-await-in-loop
    const [, wasCreated] = await WorkspaceView.findOrCreate({
      where: { companyId, module, key: d.key },
      defaults: {
        companyId,
        module,
        key: d.key,
        scope: SCOPE_SYSTEM,
        ownerUserId: null,
        name: d.nameFallback || d.key,
        nameI18nKey: d.nameI18nKey || null,
        description: d.description || null,
        icon: d.icon || null,
        filter: d.filter || {},
        sort: d.sort || null,
        columns: d.columns || null,
        viewType: d.viewType || 'list',
        isDefault: Boolean(d.isDefault),
        isLocked: true,
      },
      transaction,
    });
    ensured += 1;
    if (wasCreated) created += 1;
  }

  return { created, ensured };
}

// ----------------------------------------------------------------------------
// listViews — returns DTOs with embedded prefs, applies includeHidden gate + ordering
// ----------------------------------------------------------------------------

async function listViews(
  companyId,
  userId,
  { module, includeHidden = false } = {},
  { transaction = null } = {}
) {
  ensureCompanyId(companyId);
  ensureUserId(userId);
  ensureKnownModule(module);

  await ensureSystemViewsForCompany(companyId, module, { transaction });

  // Load views visible to this user: system + personal (own).
  const rows = await WorkspaceView.findAll({
    where: {
      companyId,
      module,
      [Op.or]: [
        { scope: SCOPE_SYSTEM },
        { scope: SCOPE_PERSONAL, ownerUserId: userId },
      ],
    },
    transaction,
  });

  const viewIds = rows.map((r) => r.id);
  const prefsRows = viewIds.length
    ? await WorkspaceViewUserPref.findAll({
      where: { userId, viewId: { [Op.in]: viewIds } },
      transaction,
    })
    : [];
  const prefsById = new Map(prefsRows.map((p) => [p.viewId, p]));

  let dtos = rows.map((view) => viewToDto(view, prefsById.get(view.id) || null));

  if (!includeHidden) {
    dtos = dtos.filter((d) => !d.prefs.hidden);
  }

  dtos.sort(compareDtos);
  return dtos;
}

function compareDtos(a, b) {
  // 1) pinned first
  if (a.prefs.pinned !== b.prefs.pinned) return a.prefs.pinned ? -1 : 1;
  // 2) pinned ordered by sortOrder
  if (a.prefs.pinned && b.prefs.pinned) {
    if (a.prefs.sortOrder !== b.prefs.sortOrder) return a.prefs.sortOrder - b.prefs.sortOrder;
  }
  // 3) recently used DESC NULLS LAST
  const al = a.prefs.lastUsedAt ? new Date(a.prefs.lastUsedAt).getTime() : 0;
  const bl = b.prefs.lastUsedAt ? new Date(b.prefs.lastUsedAt).getTime() : 0;
  if (al !== bl) return bl - al;
  // 4) alphabetical
  return String(a.name).localeCompare(String(b.name));
}

// ----------------------------------------------------------------------------
// createPersonalView
// ----------------------------------------------------------------------------

async function createPersonalView(
  companyId,
  userId,
  payload = {},
  { transaction = null } = {}
) {
  return withTx(async (t) => {
    ensureCompanyId(companyId);
    ensureUserId(userId);
    ensureKnownModule(payload.module);

    const name = asText(payload.name);
    if (!name || name.length > 120) {
      throw new AppError(400, 'name must be 1..120 chars', { code: 'VALIDATION_ERROR' });
    }
    const filter = payload.filter === null || payload.filter === undefined ? {} : payload.filter;
    if (typeof filter !== 'object' || Array.isArray(filter)) {
      throw new AppError(400, 'filter must be an object', { code: 'VALIDATION_ERROR' });
    }

    const currentCount = await WorkspaceView.count({
      where: { companyId, module: payload.module, scope: SCOPE_PERSONAL, ownerUserId: userId },
      transaction: t,
    });
    if (currentCount >= PERSONAL_VIEW_LIMIT) {
      throw new AppError(409, 'PERSONAL_VIEW_LIMIT_EXCEEDED', {
        code: 'PERSONAL_VIEW_LIMIT_EXCEEDED',
        details: { limit: PERSONAL_VIEW_LIMIT, currentCount },
      });
    }

    const view = await WorkspaceView.create(
      {
        companyId,
        module: payload.module,
        key: null,
        scope: SCOPE_PERSONAL,
        ownerUserId: userId,
        name,
        nameI18nKey: null,
        description: asText(payload.description) || null,
        icon: asText(payload.icon) || null,
        filter,
        sort: payload.sort === undefined ? null : payload.sort,
        columns: payload.columns === undefined ? null : payload.columns,
        viewType: 'list',
        isDefault: false,
        isLocked: false,
      },
      { transaction: t }
    );

    return viewToDto(view, null);
  }, transaction);
}

// ----------------------------------------------------------------------------
// updatePersonalView
// ----------------------------------------------------------------------------

const PATCHABLE_FIELDS = new Set([
  'name',
  'icon',
  'description',
  'filter',
  'sort',
  'columns',
]);

async function updatePersonalView(
  companyId,
  userId,
  viewId,
  patch = {},
  { transaction = null } = {}
) {
  return withTx(async (t) => {
    ensureCompanyId(companyId);
    ensureUserId(userId);

    const view = await WorkspaceView.findOne({
      where: { id: viewId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!view) throw new AppError(404, 'View not found', { code: 'NOT_FOUND' });

    if (view.scope === SCOPE_SYSTEM) {
      throw new AppError(403, 'System view is not editable', {
        code: 'SYSTEM_VIEW_NOT_EDITABLE',
        details: { viewId },
      });
    }
    if (view.ownerUserId !== userId) {
      throw new AppError(403, 'Personal view is owned by another user', {
        code: 'PERSONAL_VIEW_NOT_OWNED',
        details: { viewId },
      });
    }

    const updates = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!PATCHABLE_FIELDS.has(k)) continue;
      if (k === 'name') {
        const name = asText(v);
        if (!name || name.length > 120) {
          throw new AppError(400, 'name must be 1..120 chars', { code: 'VALIDATION_ERROR' });
        }
        updates.name = name;
      } else if (k === 'filter') {
        if (v !== null && (typeof v !== 'object' || Array.isArray(v))) {
          throw new AppError(400, 'filter must be an object', { code: 'VALIDATION_ERROR' });
        }
        updates.filter = v || {};
      } else if (k === 'icon' || k === 'description') {
        updates[k] = asText(v) || null;
      } else {
        updates[k] = v;
      }
    }

    await view.update(updates, { transaction: t });

    const prefs = await WorkspaceViewUserPref.findOne({
      where: { userId, viewId: view.id },
      transaction: t,
    });
    return viewToDto(view, prefs);
  }, transaction);
}

// ----------------------------------------------------------------------------
// deletePersonalView
// ----------------------------------------------------------------------------

async function deletePersonalView(
  companyId,
  userId,
  viewId,
  { transaction = null } = {}
) {
  return withTx(async (t) => {
    ensureCompanyId(companyId);
    ensureUserId(userId);

    const view = await WorkspaceView.findOne({
      where: { id: viewId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!view) throw new AppError(404, 'View not found', { code: 'NOT_FOUND' });
    if (view.scope === SCOPE_SYSTEM) {
      throw new AppError(403, 'System view is not deletable', {
        code: 'SYSTEM_VIEW_NOT_DELETABLE',
        details: { viewId },
      });
    }
    if (view.ownerUserId !== userId) {
      throw new AppError(403, 'Personal view is owned by another user', {
        code: 'PERSONAL_VIEW_NOT_OWNED',
        details: { viewId },
      });
    }

    await view.destroy({ transaction: t });
    return { success: true, id: viewId };
  }, transaction);
}

// ----------------------------------------------------------------------------
// Prefs upsert helpers (pin / hide / touch)
// ----------------------------------------------------------------------------

async function loadVisibleViewOrThrow(companyId, userId, viewId, transaction) {
  const view = await WorkspaceView.findOne({
    where: {
      id: viewId,
      companyId,
      [Op.or]: [
        { scope: SCOPE_SYSTEM },
        { scope: SCOPE_PERSONAL, ownerUserId: userId },
      ],
    },
    transaction,
  });
  if (!view) {
    throw new AppError(404, 'View not found', { code: 'NOT_FOUND' });
  }
  return view;
}

async function upsertPrefs(userId, viewId, patch, transaction) {
  const [row] = await WorkspaceViewUserPref.findOrCreate({
    where: { userId, viewId },
    defaults: { userId, viewId, pinned: false, hidden: false, sortOrder: 0, lastUsedAt: null },
    transaction,
  });
  await row.update(patch, { transaction });
  return row;
}

async function pinView(
  companyId,
  userId,
  viewId,
  { pinned, sortOrder } = {},
  { transaction = null } = {}
) {
  return withTx(async (t) => {
    ensureCompanyId(companyId);
    ensureUserId(userId);

    if (typeof pinned !== 'boolean') {
      throw new AppError(400, 'pinned must be a boolean', { code: 'VALIDATION_ERROR' });
    }

    const view = await loadVisibleViewOrThrow(companyId, userId, viewId, t);

    const patch = { pinned };
    if (pinned) {
      if (Number.isInteger(sortOrder)) {
        patch.sortOrder = sortOrder;
      } else {
        const maxRow = await WorkspaceViewUserPref.findOne({
          where: { userId, pinned: true },
          include: [
            {
              model: WorkspaceView,
              as: 'view',
              where: { module: view.module, companyId },
              required: true,
              attributes: [],
            },
          ],
          order: [['sortOrder', 'DESC']],
          transaction: t,
        });
        const nextOrder = (maxRow ? Number(maxRow.sortOrder) || 0 : 0) + 1;
        patch.sortOrder = nextOrder;
      }
    }

    const prefs = await upsertPrefs(userId, viewId, patch, t);
    return { prefs: prefsToDto(prefs) };
  }, transaction);
}

async function hideView(
  companyId,
  userId,
  viewId,
  { hidden } = {},
  { transaction = null } = {}
) {
  return withTx(async (t) => {
    ensureCompanyId(companyId);
    ensureUserId(userId);

    if (typeof hidden !== 'boolean') {
      throw new AppError(400, 'hidden must be a boolean', { code: 'VALIDATION_ERROR' });
    }

    await loadVisibleViewOrThrow(companyId, userId, viewId, t);

    const patch = { hidden };
    if (hidden) patch.pinned = false; // hidden auto-unpins (spec §4).

    const prefs = await upsertPrefs(userId, viewId, patch, t);
    return { prefs: prefsToDto(prefs) };
  }, transaction);
}

async function touchView(
  companyId,
  userId,
  viewId,
  { transaction = null } = {}
) {
  return withTx(async (t) => {
    ensureCompanyId(companyId);
    ensureUserId(userId);

    await loadVisibleViewOrThrow(companyId, userId, viewId, t);
    const prefs = await upsertPrefs(userId, viewId, { lastUsedAt: new Date() }, t);
    return { prefs: prefsToDto(prefs) };
  }, transaction);
}

// ----------------------------------------------------------------------------
// Exposed for controller / tests
// ----------------------------------------------------------------------------

module.exports = {
  PERSONAL_VIEW_LIMIT,
  ensureSystemViewsForCompany,
  listViews,
  createPersonalView,
  updatePersonalView,
  deletePersonalView,
  pinView,
  hideView,
  touchView,
  // exposed for unit tests / smoke
  _internal: { viewToDto, prefsToDto, compareDtos },
};
