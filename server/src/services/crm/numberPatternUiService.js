'use strict';

const AppError = require('../../errors/AppError');

const MAX_UI_PATTERN_LENGTH = 80;
const UI_ALLOWED_CHARS_RE = /^[A-Za-z0-9\s/\-_.$()]+$/;
const UI_TOKEN_RE = /\$[A-Za-z]+(?:\([^)]*\))?/g;
const UI_SEQUENCE_TOKEN_RE = /^\$NY\((\d+)\)$/;

function asText(value) {
  return String(value ?? '').trim();
}

function validationError(message, details = null) {
  throw new AppError(400, message, {
    code: 'VALIDATION_ERROR',
    details: details || undefined,
  });
}

function validateUiPattern(pattern, fieldName = 'numberPattern') {
  const normalized = asText(pattern);
  if (!normalized) {
    validationError(`${fieldName} is required`);
  }

  if (normalized.length > MAX_UI_PATTERN_LENGTH) {
    validationError(`${fieldName} must be <= ${MAX_UI_PATTERN_LENGTH} chars`);
  }

  if (!UI_ALLOWED_CHARS_RE.test(normalized)) {
    validationError(`${fieldName} contains invalid characters`);
  }

  const tokens = normalized.match(UI_TOKEN_RE) || [];
  let hasSequenceToken = false;

  for (const tokenRaw of tokens) {
    const token = String(tokenRaw || '');
    if (token === '$Y' || token === '$YY' || token === '$M' || token === '$D') {
      continue;
    }

    const seqMatch = UI_SEQUENCE_TOKEN_RE.exec(token);
    if (seqMatch) {
      const padding = Number(seqMatch[1]);
      if (!Number.isInteger(padding) || padding < 1 || padding > 8) {
        validationError(`${fieldName} contains invalid token ${token}`);
      }
      hasSequenceToken = true;
      continue;
    }

    validationError(`${fieldName} contains unknown token ${token}`);
  }

  const withoutKnownTokens = normalized.replace(UI_TOKEN_RE, '');
  if (withoutKnownTokens.includes('$')) {
    validationError(`${fieldName} contains unknown token`);
  }

  if (!hasSequenceToken) {
    validationError(`${fieldName} must include $NY(n) token`);
  }

  return normalized;
}

function uiPatternToBackendPattern(pattern, fieldName = 'numberPattern') {
  const normalized = validateUiPattern(pattern, fieldName);
  return normalized
    .replace(/\$YY/g, '{YY}')
    .replace(/\$Y/g, '{YYYY}')
    .replace(/\$M/g, '{MM}')
    .replace(/\$D/g, '{DD}')
    .replace(/\$NY\((\d+)\)/g, (_match, padding) => `{SEQ:${padding}}`);
}

function backendPatternToUiPattern(pattern) {
  const normalized = asText(pattern);
  if (!normalized) return '';

  return normalized
    .replace(/\{YYYY\}/g, '$Y')
    .replace(/\{YY\}/g, '$YY')
    .replace(/\{MM\}/g, '$M')
    .replace(/\{DD\}/g, '$D')
    .replace(/\{SEQ:(\d+)\}/g, (_match, padding) => `$NY(${padding})`)
    .replace(/\{SEQ\}/g, '$NY(1)');
}

function buildNumberPreview({
  pattern,
  issueDate = new Date(),
  sequence = 1,
  fieldName = 'numberPattern',
} = {}) {
  const normalized = validateUiPattern(pattern, fieldName);
  const date = issueDate instanceof Date ? issueDate : new Date(issueDate);
  if (Number.isNaN(date.getTime())) {
    validationError('issueDate is invalid');
  }

  const safeSequence = Number.isInteger(sequence) && sequence > 0 ? sequence : 1;
  return normalized.replace(/\$YY|\$Y|\$M|\$D|\$NY\((\d+)\)/g, (token, padRaw) => {
    if (token === '$Y') return String(date.getUTCFullYear());
    if (token === '$YY') return String(date.getUTCFullYear()).slice(-2);
    if (token === '$M') return String(date.getUTCMonth() + 1).padStart(2, '0');
    if (token === '$D') return String(date.getUTCDate()).padStart(2, '0');

    const padding = Number(padRaw);
    return String(safeSequence).padStart(padding, '0');
  });
}

function previewUiPattern({
  pattern,
  issueDate = new Date(),
  sequence = 1,
} = {}) {
  return buildNumberPreview({
    pattern,
    issueDate,
    sequence,
    fieldName: 'numberPattern',
  });
}

module.exports = {
  MAX_UI_PATTERN_LENGTH,
  validateUiPattern,
  uiPatternToBackendPattern,
  backendPatternToUiPattern,
  buildNumberPreview,
  previewUiPattern,
};
