const FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'meta', 'link'];
const URL_ATTRS = new Set(['href', 'src', 'xlink:href']);
const COLOR_VALUE_RE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,]+\)|[a-z]{3,20})$/i;
const FONT_SIZE_RE = /^(\d+(?:\.\d+)?)(pt|px)$/i;
const FONT_MIN_PT = 6;
const FONT_MAX_PT = 96;
const PT_PER_PX = 0.75;

// isSafeUrl: проверяет условие.
const isSafeUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return false;
  return /^(https?:|mailto:|tel:|\/|#)/i.test(url);
};

// sanitizeStyle: вспомогательная логика модуля.
const sanitizeStyle = (value = '') => {
  const raw = String(value || '');
  if (!raw.trim()) return '';

  const safeDecls = [];
  raw.split(';').forEach((chunk) => {
    const [propRaw, ...rest] = chunk.split(':');
    if (!propRaw || rest.length === 0) return;

    const prop = propRaw.trim().toLowerCase();
    const cssValue = rest.join(':').trim();
    if (!cssValue) return;

    if ((prop === 'color' || prop === 'background-color') && COLOR_VALUE_RE.test(cssValue)) {
      safeDecls.push(`${prop}: ${cssValue}`);
      return;
    }

    if (prop === 'font-size' && FONT_SIZE_RE.test(cssValue)) {
      const [, rawSize, unit] = cssValue.match(FONT_SIZE_RE) || [];
      const parsed = Number(rawSize);
      if (Number.isFinite(parsed)) {
        const sizePt = unit.toLowerCase() === 'px' ? parsed * PT_PER_PX : parsed;
        const normalized = Math.max(FONT_MIN_PT, Math.min(FONT_MAX_PT, Math.round(sizePt)));
        safeDecls.push(`${prop}: ${normalized}pt`);
      }
    }
  });

  return safeDecls.join('; ');
};

// sanitizeHtml: вспомогательная логика модуля.
export function sanitizeHtml(html = '') {
  const raw = String(html || '');
  if (!raw.trim()) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return raw;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  FORBIDDEN_TAGS.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((node) => node.remove());
  });

  doc.body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }

      if (name === 'style') {
        const safeStyle = sanitizeStyle(value);
        if (safeStyle) {
          el.setAttribute('style', safeStyle);
        } else {
          el.removeAttribute(attr.name);
        }
        return;
      }

      if (URL_ATTRS.has(name) && !isSafeUrl(value)) {
        el.removeAttribute(attr.name);
      }
    });

    if (el.tagName === 'A') {
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  });

  return doc.body.innerHTML;
}

