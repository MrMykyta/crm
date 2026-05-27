export const MAX_NUMBER_PATTERN_LENGTH = 80;

function defaultT(_key, defaultValue = "") {
  return defaultValue;
}

export function getNumberPatternValidationMessages(t = defaultT) {
  return {
    required: t(
      "companySettings.documents.numbering.validation.required",
      "Number pattern is required"
    ),
    maxLength: t(
      "companySettings.documents.numbering.validation.maxLength",
      "Maximum length is 80 characters"
    ),
    unknownToken: t(
      "companySettings.documents.numbering.validation.unknownToken",
      "Unknown token"
    ),
    missingSequence: t(
      "companySettings.documents.numbering.validation.missingSequence",
      "Pattern must contain $NY(n)"
    ),
  };
}

export function getNumberingTokenHintLines(t = defaultT) {
  return [
    t(
      "companySettings.documents.numbering.hints.tokens.year",
      "$Y — year, for example 2026"
    ),
    t(
      "companySettings.documents.numbering.hints.tokens.shortYear",
      "$YY — short year, for example 26"
    ),
    t(
      "companySettings.documents.numbering.hints.tokens.month",
      "$M — month, for example 04"
    ),
    t(
      "companySettings.documents.numbering.hints.tokens.day",
      "$D — day, for example 24"
    ),
    t(
      "companySettings.documents.numbering.hints.tokens.sequence4",
      "$NY(4) — sequential number with 4 digits, for example 0001"
    ),
    t(
      "companySettings.documents.numbering.hints.tokens.sequence5",
      "$NY(5) — sequential number with 5 digits, for example 00001"
    ),
  ];
}

export function getNumberingTokenExamples() {
  return [
    "FV/$Y/$M/$NY(4) -> FV/2026/04/0001",
    "ZAM/$Y/$M/$NY(4) -> ZAM/2026/04/0001",
    "OF/$Y/$M/$NY(4) -> OF/2026/04/0001",
  ];
}

const ALLOWED_CHARS_RE = /^[A-Za-z0-9\s/\-_.$()]+$/;
const TOKEN_RE = /\$[A-Za-z]+(?:\([^)]*\))?/g;
const SEQ_TOKEN_RE = /^\$NY\((\d+)\)$/;

export function validateNumberPattern(pattern, messages = undefined) {
  const resolvedMessages = {
    ...getNumberPatternValidationMessages(defaultT),
    ...(messages || {}),
  };

  const normalized = String(pattern || "").trim();
  if (!normalized) {
    return resolvedMessages.required;
  }

  if (normalized.length > MAX_NUMBER_PATTERN_LENGTH) {
    return resolvedMessages.maxLength;
  }

  if (!ALLOWED_CHARS_RE.test(normalized)) {
    return resolvedMessages.unknownToken;
  }

  const tokens = normalized.match(TOKEN_RE) || [];
  let hasSequence = false;

  for (const token of tokens) {
    if (token === "$Y" || token === "$YY" || token === "$M" || token === "$D") {
      continue;
    }

    const seqMatch = SEQ_TOKEN_RE.exec(token);
    if (seqMatch) {
      const padding = Number(seqMatch[1]);
      if (!Number.isInteger(padding) || padding < 1 || padding > 8) {
        return resolvedMessages.unknownToken;
      }
      hasSequence = true;
      continue;
    }

    return resolvedMessages.unknownToken;
  }

  const withoutTokens = normalized.replace(TOKEN_RE, "");
  if (withoutTokens.includes("$")) {
    return resolvedMessages.unknownToken;
  }

  if (!hasSequence) {
    return resolvedMessages.missingSequence;
  }

  return "";
}

export function buildNumberPatternPreview({
  pattern,
  sequence,
  nextSequence = 1,
  issueDate = new Date(),
}) {
  const validationError = validateNumberPattern(pattern);
  if (validationError) return "";

  const date = issueDate instanceof Date ? issueDate : new Date(issueDate);
  if (Number.isNaN(date.getTime())) return "";

  const resolvedSequence = Number.isInteger(sequence)
    ? sequence
    : (Number.isInteger(nextSequence) ? nextSequence : Number(nextSequence));
  if (!Number.isInteger(resolvedSequence) || resolvedSequence <= 0) return "";

  return String(pattern).replace(/\$YY|\$Y|\$M|\$D|\$NY\((\d+)\)/g, (token, padRaw) => {
    if (token === "$Y") return String(date.getUTCFullYear());
    if (token === "$YY") return String(date.getUTCFullYear()).slice(-2);
    if (token === "$M") return String(date.getUTCMonth() + 1).padStart(2, "0");
    if (token === "$D") return String(date.getUTCDate()).padStart(2, "0");

    const padding = Number(padRaw);
    return String(resolvedSequence).padStart(padding, "0");
  });
}
