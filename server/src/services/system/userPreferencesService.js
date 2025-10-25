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
    const existing = await UserPreferences.findOne({ where: { userId } });
    const allowed = {};

    if (payload.language != null) allowed.language = String(payload.language);
    if (payload.themeMode != null) allowed.themeMode = String(payload.themeMode);
    if (payload.background != null) allowed.background = payload.background;

    // appearance нужно мержить с существующим
    if (payload.appearance != null) {
      try {
        const oldApp = existing?.appearance || {};
        const newApp = payload.appearance || {};
        // глубокое объединение (рекурсивно)
        const deepMerge = (target, source) => {
          for (const key of Object.keys(source)) {
            if (
              source[key] &&
              typeof source[key] === "object" &&
              !Array.isArray(source[key])
            ) {
              if (!target[key]) target[key] = {};
              deepMerge(target[key], source[key]);
            } else {
              target[key] = source[key];
            }
          }
          return target;
        };
        allowed.appearance = deepMerge(JSON.parse(JSON.stringify(oldApp)), newApp);
      } catch (e) {
        console.error("Ошибка merge appearance:", e);
        allowed.appearance = payload.appearance;
      }
    }

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