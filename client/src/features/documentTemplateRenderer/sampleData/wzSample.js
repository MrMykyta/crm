const wzSample = {
  company: {
    legalName: "ACME Sp. z o.o.",
    name: "ACME",
    addressLine1: "ul. Przemysłowa 12",
    city: "Warszawa",
    postalCode: "00-950",
    country: "PL",
  },
  counterparty: {
    legalName: "Sklep Partnerski Beta",
    name: "Sklep Beta",
    addressLine1: "ul. Magazynowa 5",
    city: "Kraków",
    postalCode: "30-300",
    country: "PL",
  },
  documentType: {
    key: "wz",
    displayName: "WZ",
  },
  document: {
    number: "WZ/04/2026/017",
    type: "wz",
    typeLabel: "Wydanie zewnętrzne",
    issueDate: "2026-04-23",
    saleDate: "2026-04-23",
    notes: "Towar wydany z magazynu głównego.",
  },
  payment: {},
  totals: {
    net: 0,
    vat: 0,
    gross: 0,
  },
  items: [
    {
      lp: 1,
      name: "Produkt magazynowy A",
      quantity: 12,
      unit: "szt",
    },
    {
      lp: 2,
      name: "Produkt magazynowy B",
      quantity: 5,
      unit: "szt",
    },
  ],
  warehouse: {
    source: {
      name: "Magazyn główny",
      code: "MAG-01",
    },
    destination: {
      name: "Magazyn odbiorcy",
      code: "MAG-EXT",
    },
  },
  shipment: {},
  signatures: {},
  user: {
    name: "Operator Magazynu",
  },
  computed: {},
};

export default wzSample;
