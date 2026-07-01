'use strict';

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { parseTemplateVersionContent } = require('../template/templateVersionParser');
const { getSampleDataContext } = require('./sampleDataProvider');
const { createDocumentRendererCore, getRendererCss } = require('../../../../../shared/template/renderer');

const DocumentRendererCore = createDocumentRendererCore(React);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRenderContext(renderContext = {}, templateDraft = {}) {
  return {
    mode: renderContext?.mode || 'pdf',
    channel: renderContext?.channel || 'pdf',
    locale: renderContext?.locale || templateDraft.defaultLocale || 'pl',
    isEditorInteractive: false,
  };
}

function pageCss(templateDraft = {}) {
  const page = templateDraft.page || {};
  const size = String(page.size || 'A4').toUpperCase();
  const orientation = page.orientation === 'landscape' ? 'landscape' : 'portrait';
  const margins = page.margins || {};
  const top = Number.isFinite(Number(margins.top)) ? Number(margins.top) : 20;
  const right = Number.isFinite(Number(margins.right)) ? Number(margins.right) : 15;
  const bottom = Number.isFinite(Number(margins.bottom)) ? Number(margins.bottom) : 20;
  const left = Number.isFinite(Number(margins.left)) ? Number(margins.left) : 15;

  return `
@page {
  size: ${size} ${orientation};
  margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
}
html {
  background: #ffffff;
  color: #111827;
  font-family: Inter, Arial, "Helvetica Neue", sans-serif;
}
body {
  margin: 0;
  background: #ffffff;
}
.document-render-page {
  width: 100%;
  min-height: 100%;
}
${getRendererCss()}
`;
}

function resolveRenderInput({ templateDraft, dataContext, renderContext = {} }) {
  const parsedDraft = parseTemplateVersionContent(templateDraft);
  const resolvedDataContext =
    dataContext && typeof dataContext === 'object'
      ? dataContext
      : getSampleDataContext(parsedDraft.documentTypeKey);

  return {
    templateDraft: parsedDraft,
    dataContext: resolvedDataContext,
    renderContext: normalizeRenderContext(renderContext, parsedDraft),
  };
}

function renderTemplateToHtml({ templateDraft, dataContext, renderContext = {} }) {
  const input = resolveRenderInput({ templateDraft, dataContext, renderContext });
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(DocumentRendererCore, {
      templateDraft: input.templateDraft,
      dataContext: input.dataContext,
      renderContext: input.renderContext,
    })
  );

  if (!markup || typeof markup !== 'string') {
    throw new Error('Template renderer returned empty markup.');
  }

  const locale = escapeHtml(input.renderContext.locale || input.templateDraft.defaultLocale || 'pl');
  const title = escapeHtml(
    input.dataContext?.document?.typeLabel ||
      input.dataContext?.documentType?.displayName ||
      input.templateDraft.templateName ||
      'Document'
  );

  return [
    '<!doctype html>',
    `<html lang="${locale}">`,
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    `<style>${pageCss(input.templateDraft)}</style>`,
    '</head>',
    '<body>',
    '<main class="document-render-page">',
    markup,
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

/**
 * TODO(M4): Preview controller/router is intentionally not wired here yet.
 * Add endpoint wiring once backend routing surface is approved for preview flow.
 *
 * TODO(M4): Implement server HTML rendering only through the shared React
 * DocumentTemplateRenderer using renderToStaticMarkup (or equivalent).
 * This module must remain a foundation boundary and must not contain a
 * second custom rendering implementation.
 */

module.exports = {
  resolveRenderInput,
  renderTemplateToHtml,
};
