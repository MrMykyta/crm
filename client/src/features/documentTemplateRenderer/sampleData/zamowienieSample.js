const zamowienieSample = {
  company: {
    legalName: "ACME Sp. z o.o.",
    name: "ACME",
    addressLine1: "ul. Przemysłowa 12",
    city: "Warszawa",
    postalCode: "00-950",
    country: "PL",
    email: "zamowienia@acme.pl",
    phone: "+48 22 000 00 00",
  },
  counterparty: {
    legalName: "Dostawca XYZ Sp. z o.o.",
    name: "Dostawca XYZ",
    addressLine1: "ul. Produkcyjna 88",
    city: "Łódź",
    postalCode: "90-200",
    country: "PL",
  },
  documentType: {
    key: "zamowienie",
    displayName: "Zamówienie",
  },
  document: {
    number: "ZAM/04/2026/0099",
    type: "zamowienie",
    typeLabel: "Zamówienie",
    issueDate: "2026-04-23",
    saleDate: "2026-04-23",
    notes: "Prosimy o realizację do 30.04.2026.",
  },
  payment: {},
  totals: {
    net: 3200,
    vat: 0,
    gross: 3200,
  },
  items: [
    {
      lp: 1,
      name: "Komponent A",
      quantity: 40,
      unit: "szt",
      unitNetPrice: 80,
      netAmount: 3200,
      grossAmount: 3200,
    },
  ],
  warehouse: {},
  shipment: {},
  signatures: {},
  user: {
    name: "Mateusz Wiśniewski",
  },
  computed: {},
};

export default zamowienieSample;
