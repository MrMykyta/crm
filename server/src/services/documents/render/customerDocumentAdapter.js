'use strict';

const DOC_TYPE_MAP = Object.freeze({
  offer: 'oferta',
  invoice: 'faktura_vat',
  credit_note: 'korekta',
  creditNote: 'korekta',
});

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function toIsoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(+date)) return asText(value);
  return date.toISOString().slice(0, 10);
}

function customerName(entity) {
  return entity?.name || entity?.shortName || entity?.fullName || entity?.companyName || '';
}

function splitAddress(entity = {}) {
  const cityLine = [entity?.postalCode, entity?.city].filter(Boolean).join(' ');
  return {
    addressLine1: entity?.address || entity?.street || entity?.addressLine1 || '',
    postalCode: entity?.postalCode || '',
    city: entity?.city || cityLine,
    country: entity?.country || '',
  };
}

function normalizeLine(line = {}, fallbackName = '') {
  const qty = asNumber(line.qty ?? line.quantity, 0);
  const taxRate = asNumber(line.taxRate ?? line.vatRate ?? line.vatRateSnapshot, 0);
  const rawUnitPrice = line.unitPrice ?? line.unitPriceNet ?? line.priceNet;
  const fallbackUnitPrice = qty > 0
    ? asNumber(line.net ?? line.netAmount ?? line.lineNet ?? line.lineTotalNet ?? line.lineSubtotalNet, 0) / qty
    : 0;
  const unitPrice = asNumber(rawUnitPrice, fallbackUnitPrice);
  const baseNet = qty * unitPrice;
  const discountValue = Math.max(0, asNumber(line.discountValue, 0));
  const discountAmount = line.discountType === 'fixed'
    ? Math.min(discountValue, baseNet)
    : line.discountType === 'percent'
      ? baseNet * (discountValue / 100)
      : 0;
  const defaultNet = Math.max(0, baseNet - discountAmount);
  const net = asNumber(line.net ?? line.netAmount ?? line.lineNet ?? line.lineTotalNet, defaultNet);
  const vat = asNumber(line.tax ?? line.vat ?? line.vatAmount ?? line.lineVat ?? line.taxAmount, net * (taxRate / 100));
  const gross = asNumber(line.lineTotal ?? line.gross ?? line.grossAmount ?? line.lineGross ?? line.lineTotalGross, net + vat);

  return {
    id: line.id || line.localId || `${fallbackName}-${qty}-${gross}`,
    name: asText(line.name || line.nameSnapshot || line.productName) || fallbackName,
    description: asText(line.description || line.descriptionSnapshot || line.skuSnapshot),
    quantity: qty,
    unit: line.unit || line.unitSnapshot || 'szt.',
    unitNetPrice: unitPrice,
    vatRate: taxRate,
    netAmount: net,
    vatAmount: vat,
    grossAmount: gross,
  };
}

function buildTaxRows(lines = [], explicitTaxes = []) {
  if (Array.isArray(explicitTaxes) && explicitTaxes.length) {
    return explicitTaxes.map((tax, index) => {
      const rate = asNumber(tax.rate ?? tax.taxRate ?? tax.vatRate, 0);
      const net = asNumber(tax.net ?? tax.totalNet ?? tax.base ?? tax.taxableAmount, 0);
      const vat = asNumber(tax.vat ?? tax.totalTax ?? tax.totalVat ?? tax.amount ?? tax.vatAmount, 0);
      return {
        id: tax.id || `${rate}-${index}`,
        rate,
        net,
        vat,
        gross: asNumber(tax.gross ?? tax.totalGross, net + vat),
      };
    });
  }

  const map = new Map();
  lines.forEach((line) => {
    const rate = asNumber(line.vatRate, 0);
    const current = map.get(rate) || { rate, net: 0, vat: 0, gross: 0 };
    current.net += asNumber(line.netAmount, 0);
    current.vat += asNumber(line.vatAmount, 0);
    current.gross += asNumber(line.grossAmount, 0);
    map.set(rate, current);
  });
  return Array.from(map.values()).map((tax) => ({
    ...tax,
    id: String(tax.rate),
  }));
}

function totalsFromLines(lines = [], totals = {}, currency = 'PLN') {
  const net = asNumber(totals.net ?? totals.totalNet, lines.reduce((sum, line) => sum + asNumber(line.netAmount, 0), 0));
  const vat = asNumber(totals.vat ?? totals.tax ?? totals.totalTax ?? totals.totalVat, lines.reduce((sum, line) => sum + asNumber(line.vatAmount, 0), 0));
  const gross = asNumber(totals.gross ?? totals.totalGross, lines.reduce((sum, line) => sum + asNumber(line.grossAmount, 0), 0));
  return {
    net,
    vat,
    gross,
    currency,
    amountDue: totals.amountDue !== undefined ? asNumber(totals.amountDue, 0) : undefined,
  };
}

function normalizeCompany(company = {}) {
  const address = splitAddress(company);
  return {
    legalName: company.legalName || company.name || 'Sunset',
    name: company.name || company.legalName || 'Sunset',
    addressLine1: company.addressLine1 || address.addressLine1,
    postalCode: company.postalCode || address.postalCode,
    city: company.city || address.city,
    country: company.country || address.country,
    nip: company.nip || company.taxId || '',
    regon: company.regon || '',
    email: company.email || '',
    phone: company.phone || '',
    bankName: company.bankName || company.bank || '',
    bankAccount: company.bankAccount || '',
    footer: company.footer || '',
  };
}

function normalizeCounterparty(customer = {}) {
  const address = splitAddress(customer);
  return {
    legalName: customer.legalName || customerName(customer),
    name: customerName(customer),
    addressLine1: customer.addressLine1 || address.addressLine1,
    postalCode: customer.postalCode || address.postalCode,
    city: customer.city || address.city,
    country: customer.country || address.country,
    nip: customer.nip || customer.taxId || '',
    regon: customer.regon || '',
    email: customer.email || '',
    phone: customer.phone || '',
  };
}

function createDocumentRenderDto(input = {}) {
  const currency = input.currency || input.totals?.currency || 'PLN';
  const lines = (Array.isArray(input.lines) ? input.lines : []).map((line, index) => normalizeLine(line, `Line ${index + 1}`));
  const totals = totalsFromLines(lines, input.totals || {}, currency);
  return {
    type: input.type || 'document',
    entity: input.entity || {},
    company: input.company || {},
    customer: input.customer || {},
    lines,
    totals,
    taxes: buildTaxRows(lines, input.taxes),
    terms: input.terms || {},
    notes: input.notes || '',
    locale: input.locale,
    currency,
    accessMeta: input.accessMeta || {},
  };
}

function getDocumentTypeKey(type) {
  return DOC_TYPE_MAP[type] || DOC_TYPE_MAP[String(type || '').toLowerCase()] || 'oferta';
}

function getTypeLabel(typeKey) {
  if (typeKey === 'faktura_vat') return 'Faktura VAT';
  if (typeKey === 'korekta') return 'Korekta';
  return 'Oferta Handlowa';
}

function buildDocumentDataContext(dto = {}) {
  const renderDto = createDocumentRenderDto(dto);
  const documentTypeKey = getDocumentTypeKey(renderDto.type);
  const company = normalizeCompany(renderDto.company);
  const counterparty = normalizeCounterparty(renderDto.customer);
  const notes = [
    renderDto.notes,
    renderDto.terms?.reason ? `Powod: ${renderDto.terms.reason}` : '',
    renderDto.terms?.sourceInvoice ? `Dokument zrodlowy: ${renderDto.terms.sourceInvoice}` : '',
    renderDto.terms?.sourceOrder ? `Zamowienie: ${renderDto.terms.sourceOrder}` : '',
  ].filter(Boolean).join('\n');

  return {
    document: {
      id: renderDto.entity?.id || '',
      type: renderDto.type,
      typeKey: documentTypeKey,
      typeLabel: getTypeLabel(documentTypeKey),
      number: renderDto.entity?.number || renderDto.entity?.title || '-',
      status: renderDto.entity?.status || '',
      issueDate: toIsoDate(renderDto.entity?.issueDate),
      saleDate: toIsoDate(renderDto.entity?.saleDate || renderDto.entity?.issueDate),
      deliveryDate: toIsoDate(renderDto.terms?.deliveryDate),
      currency: renderDto.currency || 'PLN',
      notes,
      privateNotes: renderDto.entity?.subtitle || '',
      validUntil: toIsoDate(renderDto.entity?.dueDate),
      sourceInvoice: renderDto.terms?.sourceInvoice || '',
      sourceOrder: renderDto.terms?.sourceOrder || '',
    },
    company,
    counterparty,
    buyer: counterparty,
    receiver: counterparty,
    items: renderDto.lines,
    totals: {
      ...renderDto.totals,
      byVatRate: renderDto.taxes,
    },
    payment: {
      method: renderDto.terms?.payment || '',
      methodLabel: renderDto.terms?.payment || '',
      dueDate: toIsoDate(renderDto.entity?.dueDate),
      daysNet: renderDto.terms?.paymentDays || '',
      bankAccount: company.bankAccount,
      bankName: company.bankName,
    },
    terms: renderDto.terms || {},
    accessMeta: renderDto.accessMeta || {},
  };
}

function buildOfferDocumentDto({ offer, locale }) {
  const currency = offer?.currency || 'PLN';
  return createDocumentRenderDto({
    type: 'offer',
    entity: {
      id: offer?.id,
      number: offer?.number || offer?.title || 'New offer',
      issueDate: offer?.issueDate || offer?.createdAt,
      dueDate: offer?.validUntil,
      status: offer?.status,
      title: offer?.title || offer?.number,
      subtitle: offer?.subject,
    },
    company: {
      name: 'Sunset',
      footer: offer?.notes,
    },
    customer: offer?.counterparty || offer?.customer || {},
    lines: (offer?.items || []).map((item) => ({
      id: item.id || item.localId,
      name: item.name || item.nameSnapshot,
      description: item.descriptionSnapshot || item.skuSnapshot,
      qty: item.qty ?? item.quantity,
      unitPrice: item.priceNet ?? item.unitPriceNet,
      taxRate: item.taxRate ?? item.vatRateSnapshot,
      discountType: item.discountType,
      discountValue: item.discountValue,
      net: item.lineNet ?? item.lineSubtotalNet,
      tax: item.lineVat,
      lineTotal: item.lineGross ?? item.lineTotalGross,
    })),
    totals: {
      net: offer?.subtotalNet ?? offer?.totalNet,
      tax: offer?.totalVat ?? offer?.totalTax,
      gross: offer?.totalGross,
    },
    terms: {
      payment: offer?.paymentTerms,
      delivery: offer?.deliveryTerms,
    },
    notes: offer?.notes,
    locale,
    currency,
  });
}

function buildInvoiceDocumentDto({ invoice, locale }) {
  const currency = invoice?.currencyCode || invoice?.currency || invoice?.order?.currencyCode || 'PLN';
  const customer = invoice?.counterparty || invoice?.order?.counterparty || invoice?.order?.customer || {};
  return createDocumentRenderDto({
    type: 'invoice',
    entity: {
      id: invoice?.id,
      number: invoice?.number || invoice?.id,
      issueDate: invoice?.issueDate || invoice?.createdAt,
      dueDate: invoice?.dueDate,
      status: invoice?.status || invoice?.paymentState,
      subtitle: invoice?.order?.number || invoice?.orderId,
    },
    company: {
      name: 'Sunset',
      footer: invoice?.footerNote,
    },
    customer,
    lines: (invoice?.items || []).map((item) => ({
      id: item.id,
      name: item.nameSnapshot || item.name,
      description: item.skuSnapshot || item.descriptionSnapshot,
      qty: item.qty ?? item.quantity,
      unitPrice: item.unitPriceNet ?? item.priceNet,
      taxRate: item.taxRate ?? item.vatRate,
      net: item.lineTotalNet,
      tax: item.taxAmount ?? item.lineVat,
      lineTotal: item.lineTotalGross,
    })),
    totals: {
      net: invoice?.totalNet,
      tax: invoice?.totalVat ?? invoice?.totalTax,
      gross: invoice?.totalGross,
      amountDue: invoice?.amountDue,
    },
    taxes: invoice?.vatBreakdown || invoice?.taxes,
    terms: {
      payment: invoice?.paymentTerms,
      sourceOrder: invoice?.order?.number || invoice?.orderId,
    },
    notes: invoice?.notes,
    locale,
    currency,
  });
}

function buildCreditNoteDocumentDto({ creditNote, invoice, locale }) {
  const currency = creditNote?.currencyCode || invoice?.currencyCode || invoice?.order?.currencyCode || 'PLN';
  const customer = creditNote?.customer || invoice?.order?.counterparty || invoice?.order?.customer || {};
  const invoiceNumber = invoice?.number || creditNote?.sourceInvoice?.number || creditNote?.invoiceId || '-';
  const invoiceTotal = invoice?.totalGross || creditNote?.sourceInvoice?.totalGross;
  return createDocumentRenderDto({
    type: 'credit_note',
    entity: {
      id: creditNote?.id,
      number: creditNote?.number || creditNote?.id,
      issueDate: creditNote?.issuedAt || creditNote?.createdAt,
      status: creditNote?.status,
      subtitle: creditNote?.reason,
    },
    company: {
      name: 'Sunset',
    },
    customer,
    lines: [
      {
        id: 'source-invoice',
        name: invoiceNumber,
        description: creditNote?.reason,
        qty: 1,
        unitPrice: creditNote?.amountGross,
        taxRate: 0,
        net: creditNote?.amountGross,
        tax: 0,
        lineTotal: creditNote?.amountGross,
      },
    ],
    totals: {
      net: creditNote?.amountGross,
      tax: 0,
      gross: creditNote?.amountGross,
      amountDue: creditNote?.remainingCredit,
    },
    terms: {
      reason: creditNote?.reason,
      sourceInvoice: invoiceNumber,
      sourceInvoiceTotal: invoiceTotal,
      sourceOrder: creditNote?.sourceOrder?.number || invoice?.order?.number || creditNote?.orderId,
    },
    locale,
    currency,
  });
}

module.exports = {
  buildCreditNoteDocumentDto,
  buildDocumentDataContext,
  buildInvoiceDocumentDto,
  buildOfferDocumentDto,
  createDocumentRenderDto,
  getDocumentTypeKey,
};
