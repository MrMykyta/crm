export function pickGeneratedPdfUrl(...sources) {
  const seen = new Set();
  const queue = sources.filter(Boolean);
  const urlKeys = ['fileUrl', 'signedUrl', 'url', 'displayUrl', 'downloadUrl', 'inlineUrl', 'href'];

  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (typeof value === 'string') return value;
    if (typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);

    for (const key of urlKeys) {
      if (typeof value[key] === 'string' && value[key]) return value[key];
    }

    queue.push(value.data, value.file, value.document, value.result, value.payload, value.metadata);
  }

  return '';
}

export function reserveGeneratedPdfWindow() {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return null;
  try {
    const opened = window.open('', '_blank');
    if (opened) opened.opener = null;
    return opened;
  } catch (_error) {
    return null;
  }
}

export function closeGeneratedPdfWindow(reservedWindow) {
  if (!reservedWindow || reservedWindow.closed) return;
  try {
    reservedWindow.close();
  } catch (_error) {
    // Ignore browser restrictions; the fallback link will remain available.
  }
}

export function openGeneratedPdf(url, reservedWindow) {
  if (!url) {
    closeGeneratedPdfWindow(reservedWindow);
    return { url: '', opened: false };
  }

  closeGeneratedPdfWindow(reservedWindow);

  // Some desktop shells route programmatic window.open("_blank") into the current
  // ERP tab after async API work. Keep the workspace in place and expose a
  // normal target=_blank link for the user/browser to open safely.
  return { url, opened: false };
}
