'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseTemplateVersionContent,
  assertValidTemplateVersionContent,
} = require('../templateVersionParser');

function createValidTemplateDraft() {
  return {
    templateName: 'Standard Faktura',
    documentTypeKey: 'faktura_vat',
    schemaVersion: 1,
    defaultLocale: 'pl',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 15, bottom: 20, left: 15 },
    },
    sections: [
      {
        key: 'header',
        type: 'header',
        order: 0,
        enabled: true,
        locked: false,
        layoutMode: 'flow',
        blocks: [
          {
            key: 'document_title_1',
            type: 'document_title',
            props: {},
            bindings: {
              primary: { path: 'document.typeLabel' },
            },
          },
        ],
      },
    ],
    styleTokens: {
      colorPrimary: '#1a2744',
      fontSizeBase: 10,
    },
    locales: {
      pl: {
        'label.seller': 'Sprzedawca',
      },
    },
    printSettings: {
      headerRepeat: true,
      tableHeaderRepeat: true,
      pageBreakBefore: [],
      orphanControl: true,
    },
    legalConstraints: {
      inherited: true,
      documentTypeKey: 'faktura_vat',
      overrides: [],
    },
  };
}

test('parseTemplateVersionContent parses and validates valid content', () => {
  const input = createValidTemplateDraft();
  const parsed = parseTemplateVersionContent(input);

  assert.equal(parsed.templateName, 'Standard Faktura');
  assert.equal(parsed.documentTypeKey, 'faktura_vat');
  assert.equal(parsed.schemaVersion, 1);
});

test('parseTemplateVersionContent accepts JSON string input', () => {
  const input = JSON.stringify(createValidTemplateDraft());
  const parsed = parseTemplateVersionContent(input);

  assert.equal(parsed.defaultLocale, 'pl');
  assert.equal(Array.isArray(parsed.sections), true);
});

test('assertValidTemplateVersionContent throws on invalid content', () => {
  const invalid = createValidTemplateDraft();
  delete invalid.templateName;

  assert.throws(
    () => assertValidTemplateVersionContent(invalid),
    /Invalid template version content/
  );
});
