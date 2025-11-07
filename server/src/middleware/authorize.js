// src/acl/authorize.js
'use strict';
const { check } = require('../acl');

const needsCompany = (required) => {
  const arr = Array.isArray(required) ? required : [required];
  return arr.some(x => /^company:|^member:/.test(String(x)));
};

module.exports = (required, opts = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      if (needsCompany(required) && !req.companyId) {
        return res.status(400).json({ error: 'Company context required' });
      }

      const ok = await check({
        user: req.user,
        companyId: req.companyId,
        required,
        opts: {
          anyOf:   opts.anyOf,
          allOf:   opts.allOf,
          ownCheck:  opts.ownCheck  ? () => opts.ownCheck(req, req.user)  : undefined,
          deptCheck: opts.deptCheck ? () => opts.deptCheck(req, req.user) : undefined,
        }
      });

      if (!ok) return res.status(403).json({ error: 'Authorize Forbidden' });
      next();
    } catch (e) {
      console.error('[authorize]', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};