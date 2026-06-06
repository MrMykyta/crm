// Business rules for direct (inline) editability of commercial documents.
// A document is editable on its detail page only while it is "open"; once it is
// closed/confirmed/locked, further changes must go through corrections or
// follow-up documents (not implemented yet).

function statusKey(value) {
  return String(value || '').trim().toLowerCase();
}

const OFFER_EDITABLE_STATUSES = new Set(['draft', 'sent']);
const ORDER_EDITABLE_STATUSES = new Set(['draft', 'new', 'confirmed', 'paid']);

// Offer editable while draft/sent (not accepted/rejected/cancelled/expired).
export function isOfferEditable(offer) {
  return OFFER_EDITABLE_STATUSES.has(statusKey(offer?.status));
}

// Order editable while draft/new/confirmed/paid (not shipped/completed/cancelled/returned).
export function isOrderEditable(order) {
  return ORDER_EDITABLE_STATUSES.has(statusKey(order?.status));
}

// Invoices are read-only for now (dedicated invoice editing comes later).
export function isInvoiceEditable() {
  return false;
}
