import React from 'react';

const LINK_RE = /\b((?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;

const LEADING_PUNCT = /^[('"[{<]+/;
const TRAILING_PUNCT = /[),.!?:;"'\]}>\u2026]+$/;

// isLinkCandidate: проверяет условие.
const isLinkCandidate = (value) => {
  if (!value) return false;

  if (/^https?:\/\//i.test(value)) return true;
  if (/^www\./i.test(value)) return true;
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i.test(value);
};

// normalizeHref: нормализует входные и выходные данные.
const normalizeHref = (value) => {
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (error) {
    return null;
  }
};

// splitEdgePunctuation: вспомогательная логика модуля.
const splitEdgePunctuation = (value) => {
  const leadingMatch = value.match(LEADING_PUNCT);
  const trailingMatch = value.match(TRAILING_PUNCT);

  const leading = leadingMatch ? leadingMatch[0] : '';
  const trailing = trailingMatch ? trailingMatch[0] : '';

  const start = leading.length;
  const end = trailing ? value.length - trailing.length : value.length;
  const core = value.slice(start, end);

  return { leading, core, trailing };
};

// highlightText: вспомогательная логика модуля.
const highlightText = (text, query, className, keyBase) => {
  if (!query) return [text];

  const value = String(text || '');
  const q = String(query || '').trim();
  if (!q) return [value];

  const parts = [];
  const lowerValue = value.toLowerCase();
  const lowerQuery = q.toLowerCase();

  let cursor = 0;
  let matchIndex = lowerValue.indexOf(lowerQuery, cursor);
  let keyIndex = 0;

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(value.slice(cursor, matchIndex));
    }

    parts.push(
      <span key={`${keyBase}-h-${keyIndex++}`} className={className}>
        {value.slice(matchIndex, matchIndex + q.length)}
      </span>
    );

    cursor = matchIndex + q.length;
    matchIndex = lowerValue.indexOf(lowerQuery, cursor);
  }

  if (cursor < value.length) {
    parts.push(value.slice(cursor));
  }

  return parts;
};

// linkifyMessage: вспомогательная логика модуля.
export default function linkifyMessage(text, options = {}) {
  const value = String(text || '');
  if (!value) return [''];

  const {
    className = '',
    highlightQuery = '',
    highlightClassName = '',
    anchorProps = {},
  } = options;

  const nodes = [];
  let lastIndex = 0;
  let keyIndex = 0;

    // pushText: вспомогательная логика модуля.
const pushText = (chunk) => {
    if (!chunk) return;
    const pieces = highlightText(chunk, highlightQuery, highlightClassName, `txt-${keyIndex}`);
    pieces.forEach((piece) => {
      if (piece === '') return;
      nodes.push(piece);
      keyIndex += 1;
    });
  };

  let match = LINK_RE.exec(value);
  while (match) {
    const found = match[0];
    const start = match.index;

    if (start > lastIndex) {
      pushText(value.slice(lastIndex, start));
    }

    const { leading, core, trailing } = splitEdgePunctuation(found);
    pushText(leading);

    if (isLinkCandidate(core)) {
      const href = normalizeHref(core);
      if (href) {
        const labelParts = highlightText(
          core,
          highlightQuery,
          highlightClassName,
          `lnk-${keyIndex}`
        );

        nodes.push(
          <a
            key={`link-${keyIndex++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            {...anchorProps}
          >
            {labelParts}
          </a>
        );
      } else {
        pushText(core);
      }
    } else {
      pushText(core);
    }

    pushText(trailing);
    lastIndex = start + found.length;
    match = LINK_RE.exec(value);
  }

  if (lastIndex < value.length) {
    pushText(value.slice(lastIndex));
  }

  return nodes.length ? nodes : [value];
}

