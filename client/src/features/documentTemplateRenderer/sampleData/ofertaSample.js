const ofertaSample = {
  company: {
    legalName: "ACME Sp. z o.o.",
    name: "ACME",
    nip: "525-000-11-22",
    addressLine1: "ul. Przemysłowa 12",
    city: "Warszawa",
    postalCode: "00-950",
    country: "PL",
    email: "biuro@acme.pl",
    phone: "+48 22 000 00 00",
  },
  counterparty: {
    legalName: "ABC Retail Sp. z o.o.",
    name: "ABC Retail",
    nip: "521-100-22-33",
    addressLine1: "ul. Zakupowa 22",
    city: "Gdańsk",
    postalCode: "80-200",
    country: "PL",
  },
  documentType: {
    key: "oferta",
    displayName: "Oferta Handlowa",
  },
  document: {
    number: "OF/04/2026/0042",
    type: "oferta",
    typeLabel: "Oferta Handlowa",
    issueDate: "2026-04-23",
    saleDate: "2026-04-23",
    dueDate: "2026-05-23",
    notes: "Oferta ważna 30 dni od daty wystawienia.",
  },
  payment: {
    methodLabel: "Przelew",
    dueDate: "2026-05-23",
    daysNet: 30,
    bankAccount: "43 1050 0099 1000 0091 2345 6789",
    bankName: "ING Bank Śląski",
  },
  totals: {
    net: 5400,
    vat: 0,
    gross: 5400,
  },
  items: [
    {
      lp: 1,
      name: "Pakiet abonamentowy PRO",
      quantity: 12,
      unit: "mies.",
      unitNetPrice: 450,
      netAmount: 5400,
      grossAmount: 5400,
    },
  ],
  warehouse: {},
  shipment: {},
  signatures: {},
  user: {
    name: "Anna Nowak",
    email: "anna.nowak@acme.pl",
  },
  computed: {},
};

export default ofertaSample;
