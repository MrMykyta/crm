'use strict';

const { parseTemplateVersionContent } = require('../template/templateVersionParser');
const { getSampleDataContext } = require('./sampleDataProvider');

function resolveRenderInput({ templateDraft, dataContext, renderContext = {} }) {
  const parsedDraft = parseTemplateVersionContent(templateDraft);
  const resolvedDataContext =
    dataContext && typeof dataContext === 'object'
      ? dataContext
      : getSampleDataContext(parsedDraft.documentTypeKey);

  return {
    templateDraft: parsedDraft,
    dataContext: resolvedDataContext,
    renderContext,
  };
}

function renderTemplateToHtml({ templateDraft, dataContext, renderContext = {} }) {
  resolveRenderInput({ templateDraft, dataContext, renderContext });
  throw new Error(
    'TODO(M4): renderTemplateToHtml must use the shared React renderer via renderToStaticMarkup or equivalent. No parallel custom server renderer is allowed.'
  );
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
