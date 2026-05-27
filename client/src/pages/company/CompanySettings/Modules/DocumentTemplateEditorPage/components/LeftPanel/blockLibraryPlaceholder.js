export const BLOCK_LIBRARY_PLACEHOLDER_GROUPS = [
  {
    group: "Document",
    blocks: [
      { type: "document_title", displayName: "Document Title" },
      { type: "document_number", displayName: "Document Number" },
      { type: "document_dates", displayName: "Document Dates" },
      { type: "notes", displayName: "Notes" },
      { type: "legal_footer", displayName: "Legal Footer" },
    ],
  },
  {
    group: "Parties",
    blocks: [
      { type: "company_identity", displayName: "Company Identity" },
      { type: "counterparty_identity", displayName: "Counterparty Identity" },
    ],
  },
  {
    group: "Financial",
    blocks: [
      { type: "items_table", displayName: "Items Table" },
      { type: "totals_table", displayName: "Totals Table" },
      { type: "payment", displayName: "Payment" },
    ],
  },
];
