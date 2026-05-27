export const BINDING_GROUPS = [
  {
    key: "company",
    label: "Company",
    paths: [
      { path: "company.legalName", label: "Legal Name", sample: "ACME Sp. z o.o." },
      { path: "company.nip", label: "NIP", sample: "525-000-11-22" },
      { path: "company.regon", label: "REGON", sample: "012345678" },
      { path: "company.addressLine1", label: "Address", sample: "ul. Przemysłowa 12" },
      { path: "company.postalCode", label: "Postal Code", sample: "00-950" },
      { path: "company.city", label: "City", sample: "Warszawa" },
      { path: "company.country", label: "Country", sample: "PL" },
      { path: "company.bankAccount", label: "Bank Account", sample: "12 1140..." },
      { path: "company.bankName", label: "Bank Name", sample: "mBank" },
    ],
  },
  {
    key: "counterparty",
    label: "Counterparty",
    paths: [
      { path: "counterparty.legalName", label: "Legal Name", sample: "Klient Biznesowy S.A." },
      { path: "counterparty.nip", label: "NIP", sample: "783-001-44-55" },
      { path: "counterparty.regon", label: "REGON", sample: "987654321" },
      { path: "counterparty.addressLine1", label: "Address", sample: "ul. Handlowa 7" },
      { path: "counterparty.postalCode", label: "Postal Code", sample: "60-101" },
      { path: "counterparty.city", label: "City", sample: "Poznań" },
      { path: "counterparty.country", label: "Country", sample: "PL" },
    ],
  },
  {
    key: "document",
    label: "Document",
    paths: [
      { path: "document.number", label: "Number", sample: "FV/04/2026/0001" },
      { path: "document.typeLabel", label: "Type Label", sample: "Faktura VAT" },
      { path: "document.issueDate", label: "Issue Date", sample: "2026-04-23" },
      { path: "document.saleDate", label: "Sale Date", sample: "2026-04-23" },
      { path: "document.currency", label: "Currency", sample: "PLN" },
      { path: "document.notes", label: "Notes", sample: "Dziękujemy za zamówienie." },
      { path: "document.ksefNumber", label: "KSeF Number", sample: "KSeF:2026/04/..." },
      { path: "document.ksefDate", label: "KSeF Date", sample: "2026-04-23" },
    ],
  },
  {
    key: "payment",
    label: "Payment",
    paths: [
      { path: "payment.method", label: "Method", sample: "transfer" },
      { path: "payment.methodLabel", label: "Method Label", sample: "Przelew" },
      { path: "payment.dueDate", label: "Due Date", sample: "2026-05-07" },
      { path: "payment.daysNet", label: "Days Net", sample: "14" },
      { path: "payment.bankAccount", label: "Bank Account", sample: "12 1140..." },
      { path: "payment.bankName", label: "Bank Name", sample: "mBank" },
    ],
  },
  {
    key: "totals",
    label: "Totals",
    paths: [
      { path: "totals.net", label: "Net", sample: "1000.00" },
      { path: "totals.vat", label: "VAT", sample: "230.00" },
      { path: "totals.gross", label: "Gross", sample: "1230.00" },
      { path: "totals.grossInWords", label: "Gross In Words", sample: "jeden tysiąc..." },
      { path: "totals.byVatRate", label: "VAT Rate Rows", sample: "[...]" },
    ],
  },
  {
    key: "items",
    label: "Items",
    paths: [
      { path: "items", label: "Items Array", sample: "[...]" },
      { path: "items[*].lp", label: "LP", sample: "1" },
      { path: "items[*].name", label: "Name", sample: "Usługa wdrożeniowa" },
      { path: "items[*].description", label: "Description", sample: "Opis pozycji" },
      { path: "items[*].quantity", label: "Quantity", sample: "1" },
      { path: "items[*].unit", label: "Unit", sample: "usł." },
      { path: "items[*].unitNetPrice", label: "Unit Net Price", sample: "1000.00" },
      { path: "items[*].vatRate", label: "VAT Rate", sample: "23" },
      { path: "items[*].netAmount", label: "Net Amount", sample: "1000.00" },
      { path: "items[*].vatAmount", label: "VAT Amount", sample: "230.00" },
      { path: "items[*].grossAmount", label: "Gross Amount", sample: "1230.00" },
    ],
  },
];

const EXPLICIT_MAPPING = {
  "document_title|document.typeLabel": "primary",
  "document_number|document.number": "number",
  "document_dates|document.issueDate": "issueDate",
  "document_dates|document.saleDate": "saleDate",
  "document_dates|payment.dueDate": "dueDate",
  "company_identity|company.nip": "nip",
  "company_identity|company.legalName": "legalName",
  "counterparty_identity|counterparty.nip": "nip",
  "counterparty_identity|counterparty.legalName": "legalName",
  "items_table|items": "items",
  "items_table|items[*].name": "name",
  "items_table|items[*].quantity": "quantity",
  "items_table|items[*].unit": "unit",
  "totals_table|totals.gross": "gross",
  "totals_table|totals": "totals",
  "payment|payment.methodLabel": "methodLabel",
  "payment|payment.method": "method",
  "payment|payment.dueDate": "dueDate",
  "payment|payment.bankAccount": "bankAccount",
  "payment|payment.bankName": "bankName",
  "notes|document.notes": "primary",
  "legal_footer|document.ksefNumber": "ksefNumber",
  "legal_footer|document.ksefDate": "ksefDate",
};

function sanitizeKeySegment(segment) {
  const normalized = String(segment || "")
    .replace(/\[\*\]/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "");

  if (!normalized) return "value";
  return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
}

export function guessBindingKeyForBlock(blockType, path) {
  const type = String(blockType || "").trim();
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return "primary";
  }

  if (type === "items_table" && (normalizedPath === "items" || normalizedPath.startsWith("items[*]."))) {
    return "items";
  }

  const mappingKey = `${type}|${normalizedPath}`;
  if (EXPLICIT_MAPPING[mappingKey]) {
    return EXPLICIT_MAPPING[mappingKey];
  }

  const segments = normalizedPath.split(".").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  return sanitizeKeySegment(lastSegment);
}
