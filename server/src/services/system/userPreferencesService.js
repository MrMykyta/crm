const { UserPreferences } = require('../../models');

async function getByUserId(userId) {
    try {
        const pref = await UserPreferences.findOne({ where: { userId } });

        return pref || null;
    } catch (error) {
        return { error: error.message };
    }
}

async function upsertByUserId(userId, payload) {
  try {
    // Белый список полей, чтобы не перезаписать что-то лишнее
    const allowed = {};
    if (payload.language != null) allowed.language = String(payload.language);
    if (payload.themeMode != null) allowed.themeMode = String(payload.themeMode);
    if (payload.appearance != null) allowed.appearance = payload.appearance;
    if (payload.background != null) allowed.background = payload.background;
    const existing = await UserPreferences.findOne({ where: { userId } }) || null;
    console.log('allowed', allowed);
    if (existing) {
        await existing.update(allowed);
        return existing;
    } else {
        const created = await UserPreferences.create({ userId, ...allowed });
        return created;
    }
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = { getByUserId, upsertByUserId };