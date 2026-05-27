'use strict';

const ORDER_PRODUCT_RESERVATION_MODES = Object.freeze(['disabled', 'enabled']);
const ORDER_ANNOTATION_MODES = Object.freeze(['empty', 'copy_from_documents', 'template']);

const DEFAULT_ORDER_SETTINGS = Object.freeze({
  orderProductReservationMode: 'disabled',
  orderAnnotationMode: 'empty',
  orderAnnotationTemplateHtml: null,
});

module.exports = {
  ORDER_PRODUCT_RESERVATION_MODES,
  ORDER_ANNOTATION_MODES,
  DEFAULT_ORDER_SETTINGS,
};
