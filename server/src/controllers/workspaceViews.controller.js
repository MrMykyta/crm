'use strict';

const svc = require('../services/workspaceViews/workspaceViewsService');

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

// GET /api/workspace-views?module=&includeHidden=
module.exports.list = async (req, res, next) => {
  try {
    const data = await svc.listViews(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      {
        module: req.query.module,
        includeHidden: parseBool(req.query.includeHidden, false),
      }
    );
    res.json({ data });
  } catch (e) {
    next(e);
  }
};

// POST /api/workspace-views — create personal view
module.exports.create = async (req, res, next) => {
  try {
    const dto = await svc.createPersonalView(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      req.body || {}
    );
    res.status(201).json(dto);
  } catch (e) {
    next(e);
  }
};

// PATCH /api/workspace-views/:id
module.exports.update = async (req, res, next) => {
  try {
    const dto = await svc.updatePersonalView(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      req.params.id,
      req.body || {}
    );
    res.json(dto);
  } catch (e) {
    next(e);
  }
};

// DELETE /api/workspace-views/:id
module.exports.remove = async (req, res, next) => {
  try {
    await svc.deletePersonalView(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      req.params.id
    );
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

// POST /api/workspace-views/:id/actions/pin
module.exports.pin = async (req, res, next) => {
  try {
    const result = await svc.pinView(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      req.params.id,
      req.body || {}
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
};

// POST /api/workspace-views/:id/actions/hide
module.exports.hide = async (req, res, next) => {
  try {
    const result = await svc.hideView(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      req.params.id,
      req.body || {}
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
};

// POST /api/workspace-views/:id/actions/touch
module.exports.touch = async (req, res, next) => {
  try {
    const result = await svc.touchView(
      req.user?.companyId,
      req.user?.id || req.user?.userId,
      req.params.id
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
};
