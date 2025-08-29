// middleware/authorize.js
/**
 * authorize(required, opts?)
 * required: string | string[]  — одно право или массив (см. anyOf/allOf)
 * opts:
 *  - ownCheck:  (req) => Promise<boolean> | boolean
 *  - deptCheck: (req) => Promise<boolean> | boolean
 *  - anyOf: string[]   — достаточно любого из списка
 *  - allOf: string[]   — нужны все из списка
 */
module.exports = (required, opts = {}) => {
  const { ownCheck, deptCheck, anyOf, allOf } = opts;

  const need = Array.isArray(required) ? required : [required];

  return async (req, res, next) => {
    try {
      const u = req.user;
      if (!u) return res.status(401).send({ error: 'Unauthorized' });

      const perms = Array.isArray(u.permissions) ? u.permissions : [];

      const has = (p) => perms.includes(p);

      // 1) owner/admin short-circuit
      if (u.role === 'owner') return next();
      if (u.role === 'admin' && !(need.some(p => p.startsWith('company:')))) return next();

      // 2) anyOf / allOf (если заданы)
      if (Array.isArray(anyOf) && anyOf.some(has)) return next();
      if (Array.isArray(allOf) && allOf.every(has)) return next();

      // 3) company-wide точные права (если required как строка/массив)
      if (need.some(has)) return next();

      // 4) :own
      if (ownCheck) {
        // ищем право вида "<perm>:own" для любого из required
        const ownPermOk = need.some((p) => has(`${p}:own`));
        if (ownPermOk) {
          const ok = await Promise.resolve(ownCheck(req, u));
          if (ok) return next();
        }
      }

      // 5) :dept
      if (deptCheck) {
        const deptPermOk = need.some((p) => has(`${p}:dept`));
        if (deptPermOk) {
          const ok = await Promise.resolve(deptCheck(req, u));
          if (ok) return next();
        }
      }

      return res.status(403).send({ error: 'Forbidden' });
    } catch (err) {
      console.error('[authorize]', err);
      return res.status(500).send({ error: 'Internal server error' });
    }
  };
};
