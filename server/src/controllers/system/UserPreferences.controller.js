const userPreferencesService = require('../../services/system/userPreferencesService');

exports.getMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    //console.log("From [getMyPreferences]",userId) // зависит от твоего auth middleware
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pref = await userPreferencesService.getByUserId(userId);
    console.log("From [getMyPreferences]",pref) // зависит от твоего auth middleware
    res.status(200).send({pref} || {});
  } catch (e) { next(e); }
};

exports.upsertMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    console.log("From [upsertMyPreferences]",req.body) // зависит от твоего auth middleware
    // лёгкая валидация
    const body = req.body || {};
    if (body.themeMode && !['system','light','dark'].includes(body.themeMode)) {
      return res.status(400).json({ error: 'Invalid themeMode' });
    }
    const saved = await userPreferencesService.upsertByUserId(userId, body);
    res.status(200).send(saved);
  } catch (e) { next(e); }
};