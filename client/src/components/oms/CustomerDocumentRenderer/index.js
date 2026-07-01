import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import DocumentTemplateRenderer from '../../../features/documentTemplateRenderer';
import s from './CustomerDocumentRenderer.module.css';

const DOC_TYPE_MAP = Object.freeze({
  offer: 'oferta',
  invoice: 'faktura_vat',
  credit_note: 'korekta',
  creditNote: 'korekta',
});

const DEFAULT_STYLE_TOKENS = Object.freeze({
  fontSizeBase: 11,
  colorText: '#111827',
  colorMuted: '#64748b',
  colorAccent: '#2563eb',
  colorBorder: '#e2e8f0',
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

function splitAddress(entity) {
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

export function createDocumentRenderDto(input = {}) {
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

function makeBlock(key, type, props = {}, bindings = {}, layout = null) {
  return {
    key,
    type,
    props,
    bindings,
    ...(layout ? { layout } : {}),
  };
}

function makeSection(key, type, order, layoutMode, blocks, options = {}) {
  return {
    key,
    type,
    order,
    enabled: options.enabled !== false,
    locked: options.locked === true,
    layoutMode,
    blocks,
  };
}

function buildDefaultTemplateDraft(documentTypeKey) {
  const typeLabel = getTypeLabel(documentTypeKey);
  const isInvoice = documentTypeKey === 'faktura_vat';
  const isCreditNote = documentTypeKey === 'korekta';
  const buyerLabel = isInvoice ? 'Nabywca' : isCreditNote ? 'Odbiorca korekty' : 'Odbiorca oferty';
  const itemColumns = isInvoice || isCreditNote
    ? ['lp', 'name', 'quantity', 'unit', 'unitNetPrice', 'vatRate', 'netAmount', 'vatAmount', 'grossAmount']
    : ['lp', 'name', 'quantity', 'unit', 'unitNetPrice', 'netAmount', 'grossAmount'];

  const sections = [
    makeSection('header', 'header', 0, 'flow', [
      makeBlock('document_title_main', 'document_title', {
        uppercase: true,
        align: 'left',
        fallbackLabel: typeLabel,
      }, {
        primary: { path: 'document.typeLabel' },
      }),
      makeBlock('document_number_main', 'document_number', {
        label: 'Nr',
        showLabel: true,
      }, {
        number: { path: 'document.number' },
      }),
    ]),
    makeSection('seller_buyer', 'seller_buyer', 1, 'grid', [
      makeBlock('seller_identity', 'company_identity', {
        showAddress: true,
        showNip: true,
        showRegon: isInvoice || isCreditNote,
        showBankAccount: false,
      }, {}, {
        widthMode: 'fraction',
        widthValue: 0.5,
        minWidthPx: 220,
      }),
      makeBlock('buyer_identity', 'counterparty_identity', {
        label: buyerLabel,
        showAddress: true,
        showNip: true,
        showRegon: false,
      }, {}, {
        widthMode: 'fraction',
        widthValue: 0.5,
        minWidthPx: 220,
      }),
    ]),
    makeSection('document_meta', 'document_meta', 2, 'flow', [
      makeBlock('document_dates_main', 'document_dates', {
        showIssueDate: true,
        showSaleDate: isInvoice || isCreditNote,
        showDueDate: true,
      }, {
        issueDate: { path: 'document.issueDate' },
        saleDate: { path: 'document.saleDate' },
        dueDate: { path: 'payment.dueDate' },
      }),
    ]),
    makeSection('items_table', 'items_table', 3, 'flow', [
      makeBlock('items_table_main', 'items_table', {
        showHeader: true,
        columns: itemColumns,
      }, {
        items: { path: 'items' },
      }),
    ]),
    makeSection('totals', 'totals', 4, 'flow', [
      makeBlock('totals_table_main', 'totals_table', {
        showByVatRate: isInvoice || isCreditNote,
        showCurrency: true,
      }, {
        totals: { path: 'totals' },
        currency: { path: 'document.currency' },
      }),
    ]),
  ];

  if (!isCreditNote) {
    sections.push(makeSection('payment', 'payment', 5, 'flow', [
      makeBlock('payment_main', 'payment', {
        showMethod: true,
        showDueDate: true,
        showDaysNet: true,
        showBankAccount: true,
        showBankName: true,
      }),
    ]));
  }

  sections.push(
    makeSection('notes', 'notes', 6, 'flow', [
      makeBlock('notes_main', 'notes', {
        label: isCreditNote ? 'Powód korekty / Uwagi' : 'Uwagi',
      }, {
        primary: { path: 'document.notes' },
      }),
    ]),
    makeSection('legal_footer', 'legal_footer', 7, 'flow', [
      makeBlock('legal_footer_main', 'legal_footer', {
        allowAppendOnly: true,
        showKsefReference: isInvoice || isCreditNote,
      }),
    ], { locked: isInvoice || isCreditNote })
  );

  return {
    templateName: `${typeLabel} - default`,
    documentTypeKey,
    schemaVersion: 1,
    defaultLocale: 'pl',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 15, bottom: 20, left: 15 },
    },
    sections,
    styleTokens: DEFAULT_STYLE_TOKENS,
    locales: { pl: {} },
    printSettings: {
      headerRepeat: true,
      tableHeaderRepeat: true,
      pageBreakBefore: [],
      orphanControl: true,
    },
    legalConstraints: {
      inherited: true,
      documentTypeKey,
      overrides: [],
    },
    numberingPresetKey: null,
    layoutPresetKey: null,
  };
}

export function buildDocumentDataContext(dto = {}) {
  const renderDto = createDocumentRenderDto(dto);
  const documentTypeKey = getDocumentTypeKey(renderDto.type);
  const company = normalizeCompany(renderDto.company);
  const counterparty = normalizeCounterparty(renderDto.customer);
  const notes = [
    renderDto.notes,
    renderDto.terms?.reason ? `Powód: ${renderDto.terms.reason}` : '',
    renderDto.terms?.sourceInvoice ? `Dokument źródłowy: ${renderDto.terms.sourceInvoice}` : '',
    renderDto.terms?.sourceOrder ? `Zamówienie: ${renderDto.terms.sourceOrder}` : '',
  ].filter(Boolean).join('\n');

  return {
    document: {
      id: renderDto.entity?.id || '',
      type: renderDto.type,
      typeKey: documentTypeKey,
      typeLabel: getTypeLabel(documentTypeKey),
      number: renderDto.entity?.number || renderDto.entity?.title || '—',
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

export function buildCustomerDocumentTemplateDraft(type) {
  return buildDefaultTemplateDraft(getDocumentTypeKey(type));
}

export function buildOfferDocumentDto({ offer, form = {}, items = [], totals = {}, locale, t }) {
  const currency = form.currency || offer?.currency || 'PLN';
  return createDocumentRenderDto({
    type: 'offer',
    entity: {
      id: offer?.id,
      number: offer?.number || form.title || t?.('oms.offers.newTitle', 'New offer'),
      issueDate: form.issueDate || offer?.issueDate || offer?.createdAt,
      dueDate: form.validUntil || offer?.validUntil,
      status: offer?.status,
      title: form.title || offer?.title || offer?.number,
      subtitle: form.subject || offer?.subject,
    },
    company: {
      name: 'Sunset',
      footer: form.notes || offer?.notes,
    },
    customer: offer?.counterparty || offer?.customer || {},
    lines: items.map((item) => ({
      id: item.id || item.localId,
      name: item.name,
      description: item.descriptionSnapshot || item.skuSnapshot,
      qty: item.qty,
      unitPrice: item.priceNet,
      taxRate: item.taxRate,
      discountType: item.discountType,
      discountValue: item.discountValue,
      net: item.lineNet,
      tax: item.lineVat,
      lineTotal: item.lineGross,
    })),
    totals,
    terms: {
      payment: form.paymentTerms || offer?.paymentTerms,
      delivery: form.deliveryTerms || offer?.deliveryTerms,
    },
    notes: form.notes || offer?.notes,
    locale,
    currency,
  });
}

export function buildInvoiceDocumentDto({ invoice, items = [], currency = 'PLN', locale }) {
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
    lines: items.map((item) => ({
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

export function buildCreditNoteDocumentDto({ creditNote, invoice, currency = 'PLN', locale }) {
  const customer = creditNote?.customer || invoice?.order?.counterparty || invoice?.order?.customer || {};
  const invoiceNumber = invoice?.number || creditNote?.sourceInvoice?.number || creditNote?.invoiceId || '—';
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

export default function CustomerDocumentRenderer({ dto, onPrint, templateDraft }) {
  const { t, i18n } = useTranslation();
  const renderDto = useMemo(() => createDocumentRenderDto(dto), [dto]);
  const dataContext = useMemo(() => buildDocumentDataContext(renderDto), [renderDto]);
  const fallbackTemplate = useMemo(
    () => buildCustomerDocumentTemplateDraft(renderDto.type),
    [renderDto.type]
  );
  const resolvedTemplate = templateDraft || fallbackTemplate;
  const locale = renderDto.locale || i18n.language || resolvedTemplate.defaultLocale || 'pl';

  const printDocument = () => {
    if (typeof window === 'undefined') return;
    window.document.body.classList.add('customer-document-printing');
    onPrint?.(renderDto);
    window.print();
    window.setTimeout(() => {
      window.document.body.classList.remove('customer-document-printing');
    }, 400);
  };

  return (
    <div className={s.rendererShell}>
      <div className={s.toolbar}>
        <button type="button" className={s.printBtn} onClick={printDocument}>
          {t('oms.customerDocument.actions.print')}
        </button>
      </div>

      <div className={s.printScope}>
        <div className={s.paperShell} data-document-type={resolvedTemplate.documentTypeKey}>
          <div className={s.paperContent}>
            <DocumentTemplateRenderer
              templateDraft={resolvedTemplate}
              dataContext={dataContext}
              renderContext={{
                mode: 'screen_view',
                channel: 'screen',
                locale,
                isEditorInteractive: false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
