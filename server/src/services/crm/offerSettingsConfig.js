'use strict';

const OFFER_ANNOTATION_MODES = Object.freeze(['empty', 'copy_from_documents', 'template']);

const DEFAULT_OFFER_SETTINGS = Object.freeze({
  offerAnnotationMode: 'empty',
  offerAnnotationTemplateHtml: null,
});

const OFFER_NUMBERING_FALLBACK = Object.freeze({
  typeKey: 'offer',
  label: 'Oferta',
  numberingType: 'OFFER',
  numberPattern: 'OF/$Y/$M/$NY(4)',
  lastNumber: '0',
  nextNumber: 'OF/2026/04/0001',
  numberingSourceType: 'QUOTE',
});

module.exports = {
  OFFER_ANNOTATION_MODES,
  DEFAULT_OFFER_SETTINGS,
  OFFER_NUMBERING_FALLBACK,
};
