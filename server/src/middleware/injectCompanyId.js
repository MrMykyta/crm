// middleware/injectCompanyId.js
module.exports = function injectCompanyId(paramName = 'companyId') {
  return (req, _res, next) => {
    const cid = req.params?.[paramName];
    if (cid) {
      // для GET-списков — в query
      if (req.method === 'GET') {
        if (req.query && typeof req.query === 'object') {
          req.query[paramName] = cid;
        } else {
          req.validatedQuery = { ...(req.validatedQuery || {}), [paramName]: cid };
        }
      } else {
        // для POST/PUT/DELETE — в body
        req.body = { companyId: cid, ...req.body };
      }
    }
    next();
  };
};
