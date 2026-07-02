const crypto = require('crypto');
const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Order, OrderItem, Counterparty, Payment } = require('../../models');
const AppError = require('../../errors/AppError');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');
const {
  getCompanyInvoiceSettingsForUsage,
  resolveNumberingTypeForInvoiceDefaults,
  shouldCreateWarehouseDocument,
} = require('../crm/companyInvoiceSettingsService');
const {
  getCompanyWarehouseDocumentSettingsForUsage,
} = require('../crm/companyWarehouseDocumentSettingsService');
const paymentLedgerService = require('./paymentLedgerService');

function assertCompanyContext(userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
  return companyId;
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parsePositiveInt(value, fallback, { min = 1, max = 500 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parsePagination(query = {}) {
  const page = parsePositiveInt(query.page, 1, { min: 1, max: 100000 });
  const limit = parsePositiveInt(query.limit, 25, { min: 1, max: 100 });
  return { page, limit, offset: (page - 1) * limit };
}

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'number', 'issueDate', 'dueDate', 'totalNet', 'totalGross']);

function parseSort(query = {}) {
  const sort = SORT_FIELDS.has(asText(query.sort)) ? asText(query.sort) : 'createdAt';
  const dir = asText(query.dir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return [[sort, dir]];
}

function deriveInvoiceStatus(invoice) {
  if (invoice?.paidDate) return 'paid';
  if (invoice?.issueDate) return 'issued';
  return 'draft';
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((asNumber(value, 0) + Number.EPSILON) * factor) / factor;
}

function isPastDate(value) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function counterpartyDto(order) {
  const counterparty = order?.counterparty || order?.customer || null;
  if (!counterparty) return null;
  return {
    id: counterparty.id,
    name: counterparty.name || counterparty.shortName || counterparty.fullName || null,
    shortName: counterparty.shortName || null,
    fullName: counterparty.fullName || null,
  };
}

function orderDto(order) {
  if (!order) return null;
  const counterparty = counterpartyDto(order);
  return {
    id: order.id,
    number: order.number || null,
    status: order.status || null,
    paymentStatus: order.paymentStatus || null,
    fulfillmentStatus: order.fulfillmentStatus || null,
    currencyCode: order.currencyCode || null,
    totalNet: asNumber(order.totalNet, 0),
    totalTax: asNumber(order.totalTax, 0),
    totalGross: asNumber(order.totalGross, 0),
    placedAt: order.placedAt || null,
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    customerId: order.customerId || null,
    counterparty,
    customer: counterparty,
  };
}

function invoiceItemDto(item) {
  const raw = typeof item?.toJSON === 'function' ? item.toJSON() : (item || {});
  const taxRate = asNumber(raw.taxRate ?? raw.vatRateSnapshot, 0);
  return {
    ...raw,
    taxRate,
    vatRate: taxRate,
    vatRateSnapshot: asNumber(raw.vatRateSnapshot ?? taxRate, 0),
    lineType: raw.lineType || 'custom',
  };
}

function paymentDto(payment, fallbackCurrencyCode = null, ledger = {}) {
  if (!payment) return null;
  const allocatedAmount = asNumber(ledger.allocatedAmount, 0);
  return {
    id: payment.id,
    method: payment.method || null,
    status: payment.status || null,
    amount: asNumber(payment.amount, 0),
    direction: payment.direction || 'inbound',
    currency: payment.currency || payment.currencyCode || fallbackCurrencyCode || null,
    currencyCode: payment.currencyCode || payment.currency || fallbackCurrencyCode || null,
    reference: payment.reference || payment.transactionId || null,
    allocatedAmount,
    unappliedAmount: Number.isFinite(Number(ledger.unappliedAmount))
      ? asNumber(ledger.unappliedAmount, 0)
      : round(Math.max(0, asNumber(payment.amount, 0) - allocatedAmount), 2),
    applications: Array.isArray(ledger.applications)
      ? ledger.applications.map((application) => ({
        id: application.id,
        invoiceId: application.invoiceId,
        amount: asNumber(application.amount, 0),
        allocatedAt: application.allocatedAt || null,
      }))
      : [],
    paidAt: payment.processedAt || (['paid', 'authorized'].includes(asText(payment.status).toLowerCase()) ? payment.createdAt : null),
    processedAt: payment.processedAt || null,
    createdAt: payment.createdAt || null,
    updatedAt: payment.updatedAt || null,
  };
}

function calculateAmountPaid(payments = []) {
  return round(
    payments
      .filter((payment) => ['paid', 'authorized'].includes(asText(payment?.status).toLowerCase()))
      .reduce((sum, payment) => sum + asNumber(payment.amount, 0), 0),
    2
  );
}

function buildVatBreakdown(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    const raw = typeof item?.toJSON === 'function' ? item.toJSON() : (item || {});
    const rate = round(raw.taxRate ?? raw.vatRateSnapshot ?? 0, 4);
    const totalNet = asNumber(raw.lineTotalNet ?? raw.lineSubtotalNet, 0);
    const totalTax = asNumber(raw.lineVat ?? raw.lineTax, 0);
    const totalGross = asNumber(raw.lineTotalGross, totalNet + totalTax);
    const key = String(rate);
    const current = groups.get(key) || {
      rate,
      totalNet: 0,
      totalTax: 0,
      totalGross: 0,
      count: 0,
    };

    current.totalNet = round(current.totalNet + totalNet, 2);
    current.totalTax = round(current.totalTax + totalTax, 2);
    current.totalGross = round(current.totalGross + totalGross, 2);
    current.count += 1;
    groups.set(key, current);
  });

  return Array.from(groups.values()).sort((left, right) => left.rate - right.rate);
}

function derivePaymentState(invoice, { amountPaid = 0, amountDue = 0, overdue = false } = {}) {
  const status = deriveInvoiceStatus(invoice);
  if (status === 'draft') return 'draft';
  if (asNumber(amountDue, 0) <= 0 || invoice?.paidDate) return 'paid';
  if (asNumber(amountPaid, 0) > 0) return overdue ? 'partially_paid_overdue' : 'partially_paid';
  return overdue ? 'overdue' : 'unpaid';
}

function getAvailableActions(invoice, { amountDue = 0, paymentState = null } = {}) {
  const status = deriveInvoiceStatus(invoice);
  const isPaid = paymentState === 'paid';

  return {
    canEdit: status === 'draft',
    canIssue: false,
    canRegisterPayment: false,
    canPrint: false,
    canCreditNote: false,
    canCancel: false,
    canDelete: false,
    isTerminal: isPaid,
    deferred: {
      issue: status === 'draft',
      registerPayment: asNumber(amountDue, 0) > 0,
      creditNote: status === 'issued' || isPaid,
      cancel: status === 'draft' || status === 'issued',
      print: Boolean(invoice?.id),
    },
  };
}

function creditNoteDto(creditNote, fallbackCurrencyCode = null) {
  if (!creditNote) return null;
  const raw = typeof creditNote.toJSON === 'function' ? creditNote.toJSON() : creditNote;
  const applications = Array.isArray(raw.applications) ? raw.applications : [];
  const appliedAmount = round(applications.reduce((sum, application) => sum + asNumber(application.amount, 0), 0), 2);
  const remainingCredit = round(Math.max(0, asNumber(raw.amountGross, 0) - appliedAmount), 2);
  return {
    id: raw.id,
    number: raw.number || null,
    status: raw.status || null,
    invoiceId: raw.invoiceId || null,
    orderId: raw.orderId || null,
    amount: asNumber(raw.amountGross, 0),
    amountNet: asNumber(raw.amountNet, 0),
    amountTax: asNumber(raw.amountTax, 0),
    amountGross: asNumber(raw.amountGross, 0),
    appliedAmount,
    remainingCredit,
    unappliedAmount: remainingCredit,
    currency: raw.currency || raw.currencyCode || fallbackCurrencyCode || null,
    currencyCode: raw.currencyCode || raw.currency || fallbackCurrencyCode || null,
    reason: raw.reason || null,
    applications: applications.map((application) => ({
      id: application.id,
      invoiceId: application.invoiceId || null,
      amount: asNumber(application.amount, 0),
      allocatedAt: application.allocatedAt || null,
      createdAt: application.createdAt || null,
    })),
    issuedAt: raw.issuedAt || null,
    createdAt: raw.createdAt || null,
  };
}

function invoiceDto(invoice, { includeItems = false, payments = [], settlement = null, paymentSummaries = new Map(), creditNotes = [] } = {}) {
  if (!invoice) return null;
  const raw = typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;
  const items = Array.isArray(raw.items) ? raw.items.map(invoiceItemDto) : [];
  const fallbackCurrencyCode = raw.order?.currencyCode || raw.currencyCode || null;
  const paymentRows = Array.isArray(payments) ? payments : [];
  const mappedPayments = paymentRows.map((payment) => {
    const key = String(payment.id);
    return paymentDto(payment, fallbackCurrencyCode, paymentSummaries.get(key) || {});
  }).filter(Boolean);
  const totalGross = asNumber(raw.totalGross, 0);
  const paidFromPayments = calculateAmountPaid(paymentRows);
  const amountPaid = settlement
    ? asNumber(settlement.amountPaid, 0)
    : raw.paidDate && paidFromPayments <= 0
    ? totalGross
    : round(Math.min(totalGross, paidFromPayments), 2);
  const amountCredited = settlement ? asNumber(settlement.amountCredited, 0) : 0;
  const amountDue = settlement
    ? asNumber(settlement.amountDue, 0)
    : round(Math.max(0, totalGross - amountPaid), 2);
  const overdue = settlement ? Boolean(settlement.overdue) : amountDue > 0 && isPastDate(raw.dueDate);
  const paymentState = settlement?.paymentState || derivePaymentState(raw, { amountPaid, amountDue, overdue });
  const dto = {
    ...raw,
    status: raw.status || deriveInvoiceStatus(raw),
    counterparty: counterpartyDto(raw.order),
    order: orderDto(raw.order),
    amountPaid,
    amountCredited,
    amountDue,
    overdue,
    paymentState,
    payments: mappedPayments,
    paymentSource: {
      scope: settlement ? 'invoice_applications' : 'order',
      reason: settlement ? 'payment_applications' : 'payments_are_order_scoped',
    },
    vatBreakdown: buildVatBreakdown(items),
    creditNotes: creditNotes.map((creditNote) => creditNoteDto(creditNote, fallbackCurrencyCode)).filter(Boolean),
    availableActions: getAvailableActions(raw, { amountDue, paymentState }),
  };
  if (includeItems) {
    dto.items = items;
  }
  return dto;
}

function buildListWhere(query = {}, companyId) {
  const where = { companyId };
  const status = asText(Array.isArray(query.status) ? query.status[0] : query.status).toLowerCase();
  if (status === 'paid') {
    where.paidDate = { [Op.not]: null };
  } else if (status === 'issued') {
    where.issueDate = { [Op.not]: null };
    where.paidDate = null;
  } else if (status === 'draft') {
    where.issueDate = null;
  }
  const search = asText(Array.isArray(query.search) ? query.search[0] : query.search);
  if (search) {
    const like = `%${search}%`;
    where[Op.or] = [
      { number: { [Op.iLike]: like } },
      { '$order.counterparty.short_name$': { [Op.iLike]: like } },
      { '$order.counterparty.full_name$': { [Op.iLike]: like } },
    ];
  }
  return where;
}

// issue: проверяет бизнес-условие и возвращает boolean.
module.exports.issue = async (orderId, payload={}, options = {}) => {
    const externalTx = options.transaction || null;
    const t = externalTx || await Invoice.sequelize.transaction();
    const ownTransaction = !externalTx;
    try {
        const order = await Order.findByPk(orderId, {
          include: [
            {
              model: OrderItem,
              as: 'items',
              required: false,
            },
          ],
          order: [[{ model: OrderItem, as: 'items' }, 'sortOrder', 'ASC']],
          transaction:t,
        });
        if (!order) {
          throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
        }
        const existingInvoice = await Invoice.findOne({
          where: { companyId: order.companyId, orderId: order.id },
          transaction: t,
        });
        if (existingInvoice) {
          throw new AppError(409, 'Invoice already exists for this order', {
            code: 'INVOICE_ALREADY_EXISTS',
          });
        }
        const invoiceSettings = await getCompanyInvoiceSettingsForUsage({
          companyId: order.companyId,
          transaction: t,
        });
        const numberingMeta = resolveNumberingTypeForInvoiceDefaults(invoiceSettings);

        const issueDateSource = payload.issueDate || new Date();
        const issueDate = new Date(issueDateSource);
        if (Number.isNaN(issueDate.getTime())) {
          throw new AppError(400, 'issueDate is invalid', { code: 'VALIDATION_ERROR' });
        }

        const manualNumber = String(payload.number || '').trim();
        await assertDocumentTypeEnabled({
          companyId: order.companyId,
          documentType: numberingMeta.numberingSourceType,
          transaction: t,
        });
        const generatedNumber = manualNumber
          ? null
          : await generateNextDocumentNumber({
            companyId: order.companyId,
            documentType: numberingMeta.numberingSourceType,
            issueDate,
            transaction: t,
          });

        const paymentDays = Number.isInteger(Number(payload.paymentDays))
          ? Number(payload.paymentDays)
          : invoiceSettings.invoiceDefaultPaymentTermDays;
        const dueDate = payload.dueDate
          ? new Date(payload.dueDate)
          : new Date(issueDate.getTime() + paymentDays * 24 * 60 * 60 * 1000);
        if (Number.isNaN(dueDate.getTime())) {
          throw new AppError(400, 'dueDate is invalid', { code: 'VALIDATION_ERROR' });
        }

        // TODO(invoice-foundation): persist invoice subtype/payout method/currency/annotation in Invoice model.
        // Current Invoice schema does not have dedicated fields for these settings yet.

        const inv = await Invoice.create({
        ...payload,
        orderId: order.id,
        companyId: order.companyId,
        number: manualNumber || generatedNumber,
        issueDate,
        dueDate,
        totalNet: order.totalNet,
        totalTax: order.totalTax,
        totalGross: order.totalGross
        }, { transaction:t });

        const orderItems = Array.isArray(order.items) ? order.items : [];
        if (orderItems.length) {
          const invoiceItemIdsByOrderItemId = new Map(
            orderItems.map((item) => [item.id, crypto.randomUUID()])
          );
          await InvoiceItem.bulkCreate(
            orderItems.map((item) => {
              const parentOrderItemId = item.parentLineItemId || null;
              const mappedParentLineItemId = parentOrderItemId
                ? invoiceItemIdsByOrderItemId.get(parentOrderItemId) || null
                : null;
              return {
                id: invoiceItemIdsByOrderItemId.get(item.id),
                companyId: order.companyId,
                invoiceId: inv.id,
                orderItemId: item.id,
                productId: item.productId || null,
                variantId: item.variantId || null,
                taxCategoryId: item.taxCategoryId || null,
                parentLineItemId: mappedParentLineItemId,
                lineType: item.lineType || 'custom',
                affectsInventory: Boolean(item.affectsInventory),
                isStockTrackedSnapshot: Boolean(item.isStockTrackedSnapshot),
                skuSnapshot: item.skuSnapshot || item.sku || null,
                nameSnapshot: item.nameSnapshot || item.skuSnapshot || item.sku || 'Line item',
                descriptionSnapshot: item.descriptionSnapshot || null,
                unitSnapshot: item.unitSnapshot || null,
                productTypeSnapshot: item.productTypeSnapshot || null,
                metadataSnapshot: item.metadataSnapshot || null,
                qty: item.qty,
                priceNet: item.priceNet,
                priceGross: item.priceGross,
                taxRate: item.taxRate ?? item.vatRateSnapshot ?? 0,
                discountType: item.discountType || 'none',
                discountValue: item.discountValue || 0,
                discountAmount: item.discountAmount || 0,
                lineSubtotalNet: item.lineSubtotalNet || 0,
                lineVat: item.lineVat || 0,
                lineTotalNet: item.lineSubtotalNet || 0,
                lineTotalGross: item.lineTotalGross || 0,
                notes: item.notes || null,
                sortOrder: item.sortOrder || 0,
              };
            }),
            { transaction: t }
          );
        }

        if (shouldCreateWarehouseDocument(invoiceSettings)) {
          const warehouseSettings = await getCompanyWarehouseDocumentSettingsForUsage({
            companyId: order.companyId,
            transaction: t,
          });
          if (warehouseSettings?.warehouseDefaultNumberingSourceType) {
            // TODO(invoice-stock-update): create warehouse issue document from invoice in OMS flow
            // using warehouseSettings.warehouseDefaultNumberingSourceType.
          }
        }

        const createdInvoice = await Invoice.findByPk(inv.id, {
          include: [{ model: InvoiceItem, as: 'items', required: false }],
          order: [[{ model: InvoiceItem, as: 'items' }, 'sortOrder', 'ASC']],
          transaction: t,
        });

        if (ownTransaction) {
          await t.commit();
        }
        return createdInvoice || inv;
    } catch (e) { 
        if (ownTransaction) {
          await t.rollback();
        }
        throw e; 
    }
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (q = {}, userContext = {}) => {
  const companyId = assertCompanyContext(userContext);
  const { page, limit, offset } = parsePagination(q);
  const { rows, count } = await Invoice.findAndCountAll({
    where: buildListWhere(q, companyId),
    include: [
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'number', 'status', 'customerId'],
        required: false,
        include: [
          {
            model: Counterparty,
            as: 'counterparty',
            attributes: ['id', 'shortName', 'fullName'],
            required: false,
          },
        ],
      },
    ],
    order: parseSort(q),
    limit,
    offset,
    subQuery: false,
    distinct: true,
  });

  return {
    items: rows.map((row) => invoiceDto(row)),
    total: count,
    page,
    limit,
  };
};

// get: возвращает данные по входным параметрам сервиса.
module.exports.get = async (id, userContext = {}) => {
  const companyId = assertCompanyContext(userContext);
  const transaction = userContext.transaction || null;
  const invoice = await Invoice.findOne({
    where: { id, companyId },
    include: [
      { model: InvoiceItem, as: 'items', required: false },
      {
        model: Order,
        as: 'order',
        attributes: [
          'id',
          'number',
          'status',
          'paymentStatus',
          'fulfillmentStatus',
          'customerId',
          'currencyCode',
          'totalNet',
          'totalTax',
          'totalGross',
          'placedAt',
          'createdAt',
          'updatedAt',
        ],
        required: false,
        include: [
          {
            model: Counterparty,
            as: 'counterparty',
            attributes: ['id', 'shortName', 'fullName'],
            required: false,
          },
        ],
      },
    ],
    order: [[{ model: InvoiceItem, as: 'items' }, 'sortOrder', 'ASC']],
    transaction,
  });
  if (!invoice) return null;

  const orderId = invoice.orderId || invoice.order?.id || null;
  const payments = orderId
    ? await Payment.findAll({
      where: { companyId, orderId },
      order: [['createdAt', 'DESC']],
      transaction,
    })
    : [];
  const [settlement, paymentSummaries, creditNotes] = await Promise.all([
    paymentLedgerService.deriveInvoiceSettlement({ companyId, invoiceId: invoice.id, invoice, transaction }),
    paymentLedgerService.summarizePayments({ companyId, payments, transaction }),
    paymentLedgerService.listCreditNotesForInvoice({ companyId, invoiceId: invoice.id, transaction }),
  ]);

  return invoiceDto(invoice, {
    includeItems: true,
    payments,
    settlement,
    paymentSummaries,
    creditNotes,
  });
};

// cancel: переводит счёт в статус cancelled.
module.exports.cancel = async (id, payload={}, userContext = {}) => {
    const companyId = assertCompanyContext(userContext);
    const inv = await Invoice.findOne({ where: { id, companyId } });
    if (!inv) {
        throw new Error('Invoice not found');
    }
    // мягкая отмена без редактирования финансовых сумм
    return inv.update({ status: 'cancelled', cancelledAt: new Date(), ...payload });
};
