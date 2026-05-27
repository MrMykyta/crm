'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateRequiredBindings,
  collectBindingPaths,
} = require('../bindingValidator');

function createTemplateWithBindings(bindings) {
  return {
    templateName: 'T',
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
        key: 'meta',
        type: 'document_meta',
        order: 0,
        enabled: true,
        locked: false,
        layoutMode: 'flow',
        blocks: [
          {
            key: 'meta_1',
            type: 'document_number',
            props: {},
            bindings,
          },
        ],
      },
    ],
    styleTokens: {},
    locales: { pl: {} },
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

test('collectBindingPaths returns all binding paths from block-local bindings', () => {
  const draft = createTemplateWithBindings({
    a: { path: 'company.nip' },
    b: { path: 'document.number' },
    c: 'document.issueDate',
  });

  const paths = collectBindingPaths(draft);

  assert.equal(paths.has('company.nip'), true);
  assert.equal(paths.has('document.number'), true);
  assert.equal(paths.has('document.issueDate'), true);
});

test('validateRequiredBindings returns blocking issues for missing required bindings', () => {
  const draft = createTemplateWithBindings({
    a: { path: 'document.number' },
  });

  const issues = validateRequiredBindings({
    templateDraft: draft,
    documentTypeKey: 'faktura_vat',
  });

  assert.equal(Array.isArray(issues), true);
  assert.equal(issues.length > 0, true);
  assert.equal(issues.some((issue) => issue.code === 'REQUIRED_BINDING_MISSING'), true);
});

test('validateRequiredBindings returns no issues when all required bindings are present', () => {
  const draft = createTemplateWithBindings({
    a: { path: 'company.nip' },
    b: { path: 'document.number' },
    c: { path: 'document.issueDate' },
    d: { path: 'document.saleDate' },
    e: { path: 'items[*].name' },
    f: { path: 'items[*].quantity' },
    g: { path: 'items[*].unit' },
    h: { path: 'totals.gross' },
  });

  const issues = validateRequiredBindings({
    templateDraft: draft,
    documentTypeKey: 'faktura_vat',
  });

  assert.deepEqual(issues, []);
});


test('validateRequiredBindings returns DOCUMENT_TYPE_NOT_FOUND for unknown type', () => {
  const draft = createTemplateWithBindings({
    a: { path: 'document.number' },
  });

  const issues = validateRequiredBindings({
    templateDraft: draft,
    documentTypeKey: 'unknown_doc_type',
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'DOCUMENT_TYPE_NOT_FOUND');
  assert.equal(issues[0].severity, 'BLOCKING');
});
