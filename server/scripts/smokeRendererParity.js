'use strict';

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { renderTemplateToHtml } = require('../src/services/documents/render/render.service');
const { getSampleDataContext } = require('../src/services/documents/render/sampleDataProvider');
const { buildInitialTemplateDraft } = require('../src/services/documents/template/defaultTemplateLoader');
const { createDocumentRendererCore } = require('../../shared/template/renderer');

const DocumentRendererCore = createDocumentRendererCore(React);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesAll(haystack, needles) {
  return needles.every((needle) => haystack.includes(needle));
}

async function main() {
  const documentTypeKey = 'faktura_vat';
  const templateDraft = buildInitialTemplateDraft({
    documentTypeKey,
    templateName: 'Smoke Renderer Parity',
    defaultLocale: 'pl',
  });
  const dataContext = getSampleDataContext(documentTypeKey);
  const renderContext = {
    mode: 'pdf_smoke',
    channel: 'pdf',
    locale: 'pl',
    isEditorInteractive: false,
  };

  assert(templateDraft, 'Default template draft was not loaded.');

  const serverHtml = renderTemplateToHtml({ templateDraft, dataContext, renderContext });
  const coreMarkup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(DocumentRendererCore, {
      templateDraft,
      dataContext,
      renderContext,
    })
  );

  assert(typeof serverHtml === 'string' && serverHtml.length > 1000, 'Server HTML is unexpectedly small.');
  assert(typeof coreMarkup === 'string' && coreMarkup.length > 500, 'Core renderer markup is unexpectedly small.');
  assert(serverHtml.startsWith('<!doctype html>'), 'Server HTML must include a doctype wrapper.');

  const requiredFragments = [
    'data-document-type="faktura_vat"',
    'data-section-key="header"',
    'data-section-key="items_table"',
    'data-block-type="items_table"',
    'Faktura VAT',
    'Usługa wdrożeniowa',
  ];

  assert(
    includesAll(serverHtml, requiredFragments),
    `Server HTML is missing required fragments: ${requiredFragments
      .filter((fragment) => !serverHtml.includes(fragment))
      .join(', ')}`
  );
  assert(
    includesAll(coreMarkup, ['data-document-type="faktura_vat"', 'data-section-key="header"']),
    'Core markup is missing document metadata fragments.'
  );

  console.info('[smoke:renderer:parity] OK', {
    documentTypeKey,
    serverHtmlBytes: Buffer.byteLength(serverHtml),
    coreMarkupBytes: Buffer.byteLength(coreMarkup),
    sections: Array.isArray(templateDraft.sections) ? templateDraft.sections.length : 0,
  });
}

main().catch((error) => {
  console.error('[smoke:renderer:parity] FAILED');
  console.error(error);
  process.exit(1);
});
