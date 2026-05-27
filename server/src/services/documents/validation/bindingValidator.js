'use strict';

const { getDocumentType } = require('../templateRegistry/documentTypeRegistry');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Array.isArray(value) === false;
}

function collectBindingPaths(templateDraft) {
  const collected = new Set();
  const sections = Array.isArray(templateDraft?.sections) ? templateDraft.sections : [];

  for (const section of sections) {
    if (isPlainObject(section) === false) continue;
    if (section.enabled === false) continue;

    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    for (const block of blocks) {
      if (isPlainObject(block) === false) continue;

      const bindings = block?.bindings;
      const hasBindings = isPlainObject(bindings);
      if (hasBindings === false) continue;

      for (const bindingValue of Object.values(bindings)) {
        if (bindingValue === null || bindingValue === undefined) continue;

        if (typeof bindingValue === 'string') {
          const pathValue = bindingValue.trim();
          if (pathValue.length > 0) {
            collected.add(pathValue);
          }
          continue;
        }

        if (isPlainObject(bindingValue) && typeof bindingValue.path === 'string') {
          const pathValue = bindingValue.path.trim();
          if (pathValue.length > 0) {
            collected.add(pathValue);
          }
        }
      }
    }
  }

  return collected;
}

function validateRequiredBindings({ templateDraft, documentTypeKey }) {
  const resolvedDocumentTypeKey = documentTypeKey || templateDraft?.documentTypeKey;
  const docTypeSchema = getDocumentType(resolvedDocumentTypeKey);

  if (docTypeSchema === null) {
    return [
      {
        severity: 'BLOCKING',
        code: 'DOCUMENT_TYPE_NOT_FOUND',
        message: `Document type schema not found for key: ${resolvedDocumentTypeKey || 'undefined'}`,
      },
    ];
  }

  const requiredBindings = Array.isArray(docTypeSchema.requiredBindings)
    ? docTypeSchema.requiredBindings
    : [];

  if (requiredBindings.length === 0) {
    return [];
  }

  const existingBindings = collectBindingPaths(templateDraft);
  const issues = [];

  for (const requiredPath of requiredBindings) {
    if (existingBindings.has(requiredPath) === false) {
      issues.push({
        severity: 'BLOCKING',
        code: 'REQUIRED_BINDING_MISSING',
        message: `Required binding path is missing: ${requiredPath}`,
        target: {
          fieldKey: requiredPath,
        },
      });
    }
  }

  return issues;
}

module.exports = {
  validateRequiredBindings,
  collectBindingPaths,
};
