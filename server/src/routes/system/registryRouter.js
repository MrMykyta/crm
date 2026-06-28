'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireMember } = require('../../middleware/requireMember');
const validateQuery = require('../../middleware/validateQuery');
const registrySchema = require('../../schemas/registrySchema');
const RegistryController = require('../../controllers/registry/Registry.controller');

const router = express.Router();

const registryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  '/lookup',
  registryLimiter,
  requireMember,
  validateQuery(registrySchema.lookupQuery),
  RegistryController.lookup
);

module.exports = router;
