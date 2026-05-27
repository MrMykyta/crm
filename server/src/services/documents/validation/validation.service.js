'use strict';

const { validateStructural } = require('./structuralValidator');
const { validateRequiredBindings } = require('./bindingValidator');

function validateTemplateDraft({ templateDraft, documentTypeKey }) {
  const structuralIssues = validateStructural(templateDraft);
  const bindingIssues = validateRequiredBindings({ templateDraft, documentTypeKey });

  const issues = [...structuralIssues, ...bindingIssues];
  const hasBlocking = issues.some((issue) => issue?.severity === 'BLOCKING');

  return {
    isValid: hasBlocking === false,
    issues,
  };
}

module.exports = {
  validateTemplateDraft,
};
