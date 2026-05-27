'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateStructural } = require('../structuralValidator');

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
            key: 'document_number_1',
            type: 'document_number',
            props: {},
          },
        ],
      },
    ],
    styleTokens: {
      colorPrimary: '#1a2744',
    },
    locales: {
      pl: {},
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

test('validateStructural returns no issues for valid template', () => {
  const issues = validateStructural(createValidTemplateDraft());
  assert.deepEqual(issues, []);
});

test('validateStructural returns blocking issues for invalid template', () => {
  const invalid = createValidTemplateDraft();
  delete invalid.page;

  const issues = validateStructural(invalid);

  assert.equal(Array.isArray(issues), true);
  assert.equal(issues.length > 0, true);
  assert.equal(issues[0].severity, 'BLOCKING');
  assert.equal(issues[0].code, 'TEMPLATE_SCHEMA_INVALID');
});
