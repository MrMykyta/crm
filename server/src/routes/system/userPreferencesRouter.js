const userPreferencesRouter = require('express').Router();
const ctrl = require('../../controllers/system/UserPreferences.controller');

userPreferencesRouter.get('/me/preferences', ctrl.getMyPreferences);
userPreferencesRouter.put('/me/preferences', ctrl.upsertMyPreferences);

module.exports = userPreferencesRouter;