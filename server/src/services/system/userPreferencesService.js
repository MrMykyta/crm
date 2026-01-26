const { UserPreferences } = require('../../models');
const ApplicationError = require('../../errors/ApplicationError');

const UUID_RE = /^[0-9a-fA-F-]{32,36}$/;
const isFileApiUrl = (v) => typeof v === 'string' && v.includes('/api/files/');
const isHttpUrl = (v) => /^https?:\/\//i.test(v);

const validateBackgroundRef = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApplicationError('VALIDATION_ERROR: backgroundPath must be uuid|url|null', 400);
  }
  if (isFileApiUrl(value)) {
    throw new ApplicationError('VALIDATION_ERROR: backgroundPath must be fileId or external url', 400);
  }
  if (UUID_RE.test(value) || isHttpUrl(value)) return value;
  throw new ApplicationError('VALIDATION_ERROR: backgroundPath must be uuid|url|null', 400);
};

async function getByUserId(userId) {
    try {
        const pref = await UserPreferences.findOne({ where: { userId } });

        return pref || null;
    } catch (error) {
        return { error: error.message };
    }
}

async function upsertByUserId(userId, payload) {
  // Белый список полей, чтобы не перезаписать что-то лишнее
  const existing = await UserPreferences.findOne({ where: { userId } });
  const allowed = {};

    if (payload.language != null) allowed.language = String(payload.language);
    if (payload.themeMode != null) allowed.themeMode = String(payload.themeMode);
  if (payload.background != null) {
    const bg = payload.background || null;
    if (bg && typeof bg === 'object' && 'url' in bg) {
      allowed.background = { ...bg, url: validateBackgroundRef(bg.url) };
    } else {
      allowed.background = payload.background;
    }
  }

    // appearance нужно мержить с существующим
  if (payload.appearance != null) {
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
    const merged = deepMerge(JSON.parse(JSON.stringify(oldApp)), newApp);
    if (merged?.backgroundPath !== undefined) {
      merged.backgroundPath = validateBackgroundRef(merged.backgroundPath);
    }
    allowed.appearance = merged;
  }

  if (existing) {
    await existing.update(allowed);
    return existing;
  } else {
    const created = await UserPreferences.create({ userId, ...allowed });
    return created;
  }
}

module.exports = { getByUserId, upsertByUserId };
