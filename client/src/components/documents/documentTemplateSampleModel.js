import { getDocumentTypeConfig } from "./documentTypeConfig";
import { getDocumentStatusLabel, getPaymentStatusLabel } from "./documentStatusConfig";
import {
  mapBuyerToTemplateModel,
  mapCompanyToSellerTemplateModel,
} from "./documentTemplatePartiesMapping";

const SAMPLE_TITLES = Object.freeze({
  QUOTE: "Коммерческое предложение",
  ORDER: "Заказ покупателя",
  INVOICE: "Фактура VAT",
  BILL: "Счёт на оплату",
  RECEIPT: "Кассовый чек",
  CONTRACT: "Договор поставки",
});

const SAMPLE_NUMBERS = Object.freeze({
  QUOTE: "OFF-2026-0042",
  ORDER: "ORD-2026-0187",
  INVOICE: "INV-2026-04-0016",
  BILL: "BIL-2026-04-0011",
  RECEIPT: "RCP-2026-0049",
  CONTRACT: "CTR-2026-0012",
});

function buildItems(count = 2) {
  const size = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : 2;
  const prototypes = [
    {
      name: "Smoke Item",
      description: "Usługa serwisowa pojazdu",
      sku: "SRV",
      pkwiu: "45.20.11.0",
      quantity: 2,
      unit: "pcs",
      additionalQuantity: 1,
      additionalUnit: "h",
      unitNet: 100,
      discount: 0,
      vatRate: 23,
      rentalPeriod: "04.2026",
    },
    {
      name: "Service Package",
      description: "Materiały eksploatacyjne",
      sku: "MAT",
      pkwiu: "29.32.30.0",
      quantity: 1,
      unit: "set",
      additionalQuantity: 0,
      additionalUnit: "",
      unitNet: 80,
      discount: 0,
      vatRate: 8,
      rentalPeriod: "04.2026",
    },
  ];

  return Array.from({ length: size }, (_, index) => {
    const source = prototypes[index % prototypes.length];
    const number = index + 1;
    const quantity = source.quantity + (index % 3 === 0 ? 1 : 0);
    const unitNet = source.unitNet + (index % 4) * 3;
    const sumNet = Number((quantity * unitNet).toFixed(2));
    const sumVat = Number((sumNet * (source.vatRate / 100)).toFixed(2));
    const sumGross = Number((sumNet + sumVat).toFixed(2));
    const unitGross = Number((unitNet * (1 + source.vatRate / 100)).toFixed(2));
    return {
      id: `item-${number}`,
      lp: String(number),
      name: `${source.name} ${number}`,
      description: source.description,
      sku: `${source.sku}-${String(number).padStart(3, "0")}`,
      pkwiu: source.pkwiu,
      quantity,
      unit: source.unit,
      additionalQuantity: source.additionalQuantity,
      additionalUnit: source.additionalUnit,
      unitNet,
      unitGross,
      discount: source.discount,
      vatRate: source.vatRate,
      sumNet,
      sumVat,
      vatValue: sumVat,
      sumGross,
      rentalPeriod: source.rentalPeriod,
    };
  });
}

function buildFallbackCompany() {
  return {
    name: "Demo Company Sp. z o.o.",
    street: "ul. Przykładowa 1",
    postalCode: "00-001",
    city: "Warszawa",
    country: "PL",
    nip: "000-000-00-00",
    email: "office@demo-company.example",
    phone: "+48 500 100 200",
    website: "https://demo-company.example",
    bankName: "Bank Polska S.A.",
    bankAccount: "11 2222 3333 4444 5555 6666 7777",
  };
}

function buildFallbackBuyer() {
  return {
    shortName: "DriveSafe",
    street: "ul. Testowa 8",
    postalCode: "30-001",
    city: "Kraków",
    country: "PL",
    isCompany: true,
    nip: "555-555-55-55",
    email: "client@drivesafe.example",
    phone: "+48 700 100 200",
  };
}

export function buildDocumentTemplateSampleModel(documentType, options = {}) {
  const normalizedType = String(documentType || "QUOTE").trim().toUpperCase();
  const config = getDocumentTypeConfig(normalizedType);
  const supportsPayment = Boolean(config?.capabilities?.supportsPayment);
  const fallbackCompany = buildFallbackCompany();
  const sourceCompany = options?.company && typeof options.company === "object" ? options.company : null;
  const company = {
    ...fallbackCompany,
    ...(sourceCompany || {}),
  };
  const buyer = options?.buyer && typeof options.buyer === "object"
    ? { ...buildFallbackBuyer(), ...options.buyer }
    : buildFallbackBuyer();
  const sampleItemCount = Number.isFinite(Number(options?.itemCount))
    ? Math.max(1, Math.floor(Number(options.itemCount)))
    : 18;
  const items = normalizedType === "CONTRACT" ? [] : buildItems(sampleItemCount);
  const totals = items.reduce(
    (acc, item) => ({
      totalNet: acc.totalNet + item.sumNet,
      totalVat: acc.totalVat + item.sumVat,
      totalGross: acc.totalGross + item.sumGross,
    }),
    { totalNet: 0, totalVat: 0, totalGross: 0 }
  );

  const hasTerms = Boolean(config?.sections?.validity) || Boolean(config?.sections?.paymentTerms);
  const terms = [];
  const termsMap = {
    validFrom: "",
    validTo: "",
    validDays: "",
    paymentDueDate: "",
    paymentDays: "",
  };
  if (config?.sections?.validity) {
    terms.push({ label: "Действует с", value: "2026-04-17" });
    terms.push({ label: "Действует до", value: "2026-05-31" });
    terms.push({ label: "Срок (дней)", value: "14" });
    termsMap.validFrom = "2026-04-17";
    termsMap.validTo = "2026-05-31";
    termsMap.validDays = "14";
  }
  if (config?.sections?.paymentTerms) {
    terms.push({ label: "Оплатить до", value: "2026-04-24" });
    terms.push({ label: "Срок оплаты", value: "7 дней" });
    termsMap.paymentDueDate = "2026-04-24";
    termsMap.paymentDays = "7";
  }

  return {
    type: normalizedType,
    typeLabel: config.label,
    title: SAMPLE_TITLES[normalizedType] || config.label,
    number: SAMPLE_NUMBERS[normalizedType] || "DOC-2026-0001",
    issueDate: "2026-04-17",
    saleDate: "2026-04-17",
    deliveryDate: "2026-04-18",
    originalCopyLabel: "ORYGINAŁ",
    customerNumber: "C-1024",
    statusLabel: getDocumentStatusLabel(normalizedType, "draft"),
    directionLabel: "Продажа",
    sourceLabel: "Заказ e184deb6",
    seller: mapCompanyToSellerTemplateModel(company),
    buyer: mapBuyerToTemplateModel(buyer),
    receiver: mapBuyerToTemplateModel(buyer),
    payer: mapBuyerToTemplateModel(buyer),
    contactPerson: "Jan Kowalski",
    items,
    supportsPayment,
    payment: {
      paymentStatus: supportsPayment ? "partially_paid" : "",
      paymentStatusLabel: getPaymentStatusLabel(normalizedType, supportsPayment ? "partially_paid" : null),
      paidAmount: supportsPayment ? 120 : 0,
      remainingAmount: supportsPayment ? Math.max(totals.totalGross - 120, 0) : 0,
      paymentDate: supportsPayment ? "2026-04-20" : "",
      paymentMethod: supportsPayment ? "Przelew bankowy" : "",
      bank: company.bankName || company.bank || "",
      bankAccount: company.bankAccount || "",
    },
    terms: hasTerms ? terms : [],
    termsMap: {
      ...termsMap,
      text: "Płatność w terminie, reklamacje do 7 dni od odbioru usługi.",
    },
    termsText: "Płatność w terminie, reklamacje do 7 dni od odbioru usługi.",
    notes: "Uwagi do dokumentu: dostawa zgodnie z warunkami handlowymi.",
    internalNotes: "Internal note for operations team.",
    footer: {
      generatedBy: "CRM Sunset system",
      contacts: [company.email, company.phone, company.website].filter(Boolean).join(" • "),
      marketing: "Dziękujemy za współpracę",
      pageNumber: "1/1",
    },
    totals: {
      ...totals,
      amountDue: supportsPayment ? Math.max(totals.totalGross - 120, 0) : totals.totalGross,
      paidAmount: supportsPayment ? 120 : 0,
      remainingAmount: supportsPayment ? Math.max(totals.totalGross - 120, 0) : totals.totalGross,
      amountInWords: "trzysta trzydzieści dwa złote 40/100",
      vatBreakdown: [
        { rate: "23", vat: 46 },
        { rate: "8", vat: 6.4 },
      ],
    },
  };
}
