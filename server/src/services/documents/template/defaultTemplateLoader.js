'use strict';

const fs = require('fs');
const path = require('path');
const { parseTemplateVersionContent } = require('./templateVersionParser');

const CACHE = new Map();

function debugLog(message, payload = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.info(`[template-defaults] ${message}`, payload);
}

function uniquePaths(paths) {
  return [...new Set(paths.map((p) => path.normalize(p)))];
}

function resolveDefaultsDir() {
  const candidates = uniquePaths([
    path.resolve(process.cwd(), 'shared/template/defaults'),
    path.resolve(process.cwd(), '../shared/template/defaults'),
    path.resolve(__dirname, '../../../../../shared/template/defaults'),
    path.resolve(__dirname, '../../../../../../shared/template/defaults'),
  ]);

  debugLog('resolveDefaultsDir:candidates', {
    cwd: process.cwd(),
    candidates,
  });

  for (const candidate of candidates) {
    const exists = fs.existsSync(candidate);
    debugLog('resolveDefaultsDir:candidateCheck', { candidate, exists });
    if (exists) {
      debugLog('resolveDefaultsDir:resolved', { defaultsDir: candidate });
      return candidate;
    }
  }

  debugLog('resolveDefaultsDir:notFound', { cwd: process.cwd(), candidates });
  return null;
}

function readDefaultDraft(documentTypeKey) {
  const key = String(documentTypeKey || '').trim().toLowerCase();
  if (!key) return null;

  if (CACHE.has(key)) {
    return CACHE.get(key);
  }

  const defaultsDir = resolveDefaultsDir();
  if (!defaultsDir) {
    debugLog('readDefaultDraft:noDefaultsDir', { documentTypeKey: key });
    CACHE.set(key, null);
    return null;
  }

  const filePath = path.join(defaultsDir, `${key}.default.json`);
  const exists = fs.existsSync(filePath);
  debugLog('readDefaultDraft:fileCheck', {
    documentTypeKey: key,
    defaultsDir,
    filePath,
    exists,
  });
  if (!exists) {
    CACHE.set(key, null);
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const sectionsCount = Array.isArray(parsed?.sections) ? parsed.sections.length : 0;
  debugLog('readDefaultDraft:loaded', {
    documentTypeKey: key,
    filePath,
    sectionsCount,
  });
  CACHE.set(key, parsed);
  return parsed;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildInitialTemplateDraft({ templateName, documentTypeKey, defaultLocale }) {
  const source = readDefaultDraft(documentTypeKey);
  if (!source) return null;

  const draft = clone(source);
  const normalizedTypeKey = String(documentTypeKey || '').trim();
  const normalizedLocale = String(defaultLocale || draft.defaultLocale || 'pl').trim() || 'pl';

  draft.templateName = String(templateName || draft.templateName || 'Template');
  draft.documentTypeKey = normalizedTypeKey;
  draft.defaultLocale = normalizedLocale;

  if (!draft.locales || typeof draft.locales !== 'object' || Array.isArray(draft.locales)) {
    draft.locales = {};
  }
  if (!draft.locales[normalizedLocale] || typeof draft.locales[normalizedLocale] !== 'object') {
    draft.locales[normalizedLocale] = {};
  }

  if (
    draft.legalConstraints &&
    typeof draft.legalConstraints === 'object' &&
    !Array.isArray(draft.legalConstraints)
  ) {
    draft.legalConstraints.documentTypeKey = normalizedTypeKey;
  }

  return parseTemplateVersionContent(draft);
}

module.exports = {
  buildInitialTemplateDraft,
};
