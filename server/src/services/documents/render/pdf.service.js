'use strict';

/**
 * TODO(M4): PDF foundation only.
 * PDF generation must consume HTML produced by shared renderer path
 * (renderToStaticMarkup boundary in render.service).
 * Do not introduce dedicated PDF rendering logic here.
 */
async function renderTemplatePdf() {
  throw new Error('TODO(M4): pdf.service renderTemplatePdf is not implemented yet.');
}

module.exports = {
  renderTemplatePdf,
};
