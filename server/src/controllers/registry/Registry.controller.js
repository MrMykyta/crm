'use strict';

const asyncHandler = require('../../middleware/asyncHandler');
const RegistryService = require('../../services/registry/RegistryService');

module.exports.lookup = asyncHandler(async (req, res) => {
  const result = await RegistryService.lookup({
    country: req.query.country,
    kind: req.query.kind,
    value: req.query.value,
    forceRefresh: req.query.forceRefresh,
    companyId: req.companyId,
    userId: req.user?.id,
  });
  return res.status(200).json(result);
});
