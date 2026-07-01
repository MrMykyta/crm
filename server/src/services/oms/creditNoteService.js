'use strict';

const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  sequelize,
  CreditNote,
  CreditNoteApplication,
  Invoice,
  Order,
  Counterparty,
  Payment,
} = require('../../models');
const paymentLedgerService = require('./paymentLedgerService');
const paymentService = require('./paymentService');

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((asNumber(value, 0) + Number.EPSILON) * factor) / factor;
}

function assertCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

function assertPositiveAmount(value, fieldName = 'amount') {
  const amount = round(value, 2);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, `${fieldName} must be greater than 0`, { code: 'VALIDATION_ERROR' });
  }
  return amount;
}

async function withTransaction(existingTransaction, callback) {
  if (existingTransaction) return callback(existingTransaction);
  const tx = await sequelize.transaction();
  try {
    const result = await callback(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

function customerDto(order) {
  const counterparty = order?.counterparty || order?.customer || null;
  if (!counterparty) return null;
  return {
    id: counterparty.id,
    name: counterparty.name || counterparty.shortName || counterparty.fullName || null,
    shortName: counterparty.shortName || null,
    fullName: counterparty.fullName || null,
  };
}

function invoiceSummary(invoice) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    number: invoice.number || null,
    orderId: invoice.orderId || null,
    issueDate: invoice.issueDate || null,
    dueDate: invoice.dueDate || null,
    totalNet: asNumber(invoice.totalNet, 0),
    totalTax: asNumber(invoice.totalTax, 0),
    totalGross: asNumber(invoice.totalGross, 0),
    paidDate: invoice.paidDate || null,
  };
}

function orderSummary(order) {
  if (!order) return null;
  return {
    id: order.id,
    number: order.number || null,
    status: order.status || null,
    paymentStatus: order.paymentStatus || null,
    currencyCode: order.currencyCode || null,
    totalNet: asNumber(order.totalNet, 0),
    totalTax: asNumber(order.totalTax, 0),
    totalGross: asNumber(order.totalGross, 0),
    customerId: order.customerId || null,
    customer: customerDto(order),
  };
}

function paymentSummary(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    orderId: payment.orderId || null,
    amount: asNumber(payment.amount, 0),
    method: payment.method || null,
    status: payment.status || null,
    direction: payment.direction || null,
    currencyCode: payment.currencyCode || null,
    reference: payment.reference || payment.transactionId || null,
    processedAt: payment.processedAt || null,
    createdAt: payment.createdAt || null,
  };
}

function applicationDto(application) {
  if (!application) return null;
  const invoice = application.invoice || null;
  return {
    id: application.id,
    invoiceId: application.invoiceId || null,
    invoiceNumber: invoice?.number || null,
    amount: asNumber(application.amount, 0),
    allocatedAt: application.allocatedAt || null,
    createdAt: application.createdAt || null,
  };
}

function buildEvents(raw, applications = [], refundPayment = null) {
  const events = [];
  if (raw.issuedAt || raw.createdAt) {
    events.push({
      type: 'issued',
      at: raw.issuedAt || raw.createdAt,
      amount: asNumber(raw.amountGross, 0),
    });
  }
  applications.forEach((application) => {
    events.push({
      type: 'applied',
      at: application.allocatedAt || application.createdAt || null,
      amount: asNumber(application.amount, 0),
      invoiceId: application.invoiceId || null,
      invoiceNumber: application.invoice?.number || null,
    });
  });
  if (refundPayment) {
    events.push({
      type: 'refunded',
      at: refundPayment.processedAt || refundPayment.createdAt || null,
      amount: asNumber(refundPayment.amount, 0),
      paymentId: refundPayment.id,
      reference: refundPayment.reference || refundPayment.transactionId || null,
    });
  }
  if (raw.status === 'cancelled') {
    events.push({
      type: 'cancelled',
      at: raw.updatedAt || null,
    });
  }
  return events
    .filter((event) => event.at)
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
}

function getRefundReferencePrefix(creditNoteId) {
  return `CN-REFUND:${creditNoteId}`;
}

async function findRefundPayment({ companyId, creditNote, transaction = null }) {
  if (!creditNote?.id || !creditNote?.orderId) return null;
  return Payment.findOne({
    where: {
      companyId,
      orderId: creditNote.orderId,
      direction: 'refund',
      reference: { [Op.like]: `${getRefundReferencePrefix(creditNote.id)}%` },
    },
    order: [['createdAt', 'DESC']],
    transaction,
  });
}

function mapCreditNoteToDetailDto(creditNote, { refundPayment = null } = {}) {
  if (!creditNote) return null;
  const raw = typeof creditNote.toJSON === 'function' ? creditNote.toJSON() : creditNote;
  const applications = Array.isArray(raw.applications) ? raw.applications : [];
  const amountGross = asNumber(raw.amountGross, 0);
  const appliedAmount = round(applications.reduce((sum, application) => sum + asNumber(application.amount, 0), 0), 2);
  const refundedAmount = refundPayment ? asNumber(refundPayment.amount, 0) : 0;
  const remainingCredit = round(Math.max(0, amountGross - appliedAmount), 2);
  const refundableAmount = round(Math.max(0, remainingCredit - refundedAmount), 2);
  const order = raw.order || raw.invoice?.order || null;
  const sourceInvoice = invoiceSummary(raw.invoice);
  const sourceOrder = orderSummary(order);
  const customer = customerDto(order);
  const status = raw.status || 'issued';

  return {
    id: raw.id,
    number: raw.number || null,
    status,
    reason: raw.reason || null,
    customerId: customer?.id || sourceOrder?.customerId || null,
    customer,
    invoiceId: raw.invoiceId || sourceInvoice?.id || null,
    orderId: raw.orderId || sourceOrder?.id || null,
    sourceInvoice,
    sourceOrder,
    amount: amountGross,
    amounts: {
      amountNet: asNumber(raw.amountNet, 0),
      amountTax: asNumber(raw.amountTax, 0),
      amountGross,
      appliedAmount,
      remainingCredit,
      refundedAmount,
      refundableAmount,
    },
    amountNet: asNumber(raw.amountNet, 0),
    amountTax: asNumber(raw.amountTax, 0),
    amountGross,
    appliedAmount,
    remainingCredit,
    unappliedAmount: remainingCredit,
    refundableAmount,
    applications: applications.map(applicationDto).filter(Boolean),
    refundPayment: paymentSummary(refundPayment),
    availableActions: {
      canApply: status === 'issued' && remainingCredit > 0,
      canRefund: status === 'issued' && refundableAmount > 0,
      canCancel: status === 'issued' && appliedAmount <= 0 && refundedAmount <= 0,
      canDuplicate: false,
      deferred: {
        duplicate: true,
      },
    },
    events: buildEvents(raw, applications, refundPayment),
    issuedAt: raw.issuedAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    deletedAt: raw.deletedAt || null,
  };
}

function creditNoteInclude() {
  return [
    {
      model: Invoice,
      as: 'invoice',
      required: false,
      include: [
        {
          model: Order,
          as: 'order',
          required: false,
          include: [
            { model: Counterparty, as: 'counterparty', attributes: ['id', 'shortName', 'fullName'], required: false },
            { model: Counterparty, as: 'customer', attributes: ['id', 'shortName', 'fullName'], required: false },
          ],
        },
      ],
    },
    {
      model: Order,
      as: 'order',
      required: false,
      include: [
        { model: Counterparty, as: 'counterparty', attributes: ['id', 'shortName', 'fullName'], required: false },
        { model: Counterparty, as: 'customer', attributes: ['id', 'shortName', 'fullName'], required: false },
      ],
    },
    {
      model: CreditNoteApplication,
      as: 'applications',
      required: false,
      include: [
        { model: Invoice, as: 'invoice', required: false },
      ],
    },
  ];
}

async function loadCreditNote({ companyId, id, transaction = null, lock = null } = {}) {
  assertCompanyId(companyId);
  const creditNote = await CreditNote.findOne({
    where: { id, companyId },
    include: creditNoteInclude(),
    transaction,
    lock,
  });
  if (!creditNote) {
    throw new AppError(404, 'Credit note not found', { code: 'NOT_FOUND' });
  }
  return creditNote;
}

async function buildDetailDto({ companyId, creditNote, transaction = null } = {}) {
  const refundPayment = await findRefundPayment({ companyId, creditNote, transaction });
  return mapCreditNoteToDetailDto(creditNote, { refundPayment });
}

function buildNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CN-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function issue({ companyId, invoiceId, orderId = null, payload = {}, userId = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  const cleanInvoiceId = asText(invoiceId || payload.invoiceId);
  if (!cleanInvoiceId) {
    throw new AppError(400, 'invoiceId is required', { code: 'VALIDATION_ERROR' });
  }

  return withTransaction(transaction, async (tx) => {
    const invoice = await Invoice.findOne({
      where: { id: cleanInvoiceId, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!invoice) {
      throw new AppError(404, 'Invoice not found', { code: 'NOT_FOUND' });
    }

    const amountGross = assertPositiveAmount(payload.amountGross ?? payload.amount ?? invoice.totalGross, 'amountGross');
    const invoiceTotal = asNumber(invoice.totalGross, 0);
    if (amountGross > invoiceTotal) {
      throw new AppError(409, 'Credit note amount cannot exceed source invoice total', {
        code: 'CREDIT_NOTE_AMOUNT_EXCEEDS_INVOICE',
        details: { invoiceId: invoice.id, amountGross, invoiceTotal },
      });
    }

    const amountNet = round(payload.amountNet ?? amountGross, 2);
    const amountTax = round(payload.amountTax ?? Math.max(0, amountGross - amountNet), 2);
    const creditNote = await CreditNote.create({
      companyId,
      invoiceId: invoice.id,
      orderId: asText(orderId || payload.orderId || invoice.orderId) || null,
      number: asText(payload.number) || buildNumber(),
      status: 'issued',
      issuedAt: payload.issuedAt || new Date(),
      amountNet,
      amountTax,
      amountGross,
      reason: asText(payload.reason) || null,
    }, { transaction: tx });

    const detail = await loadCreditNote({
      companyId,
      id: creditNote.id,
      transaction: tx,
    });
    return buildDetailDto({ companyId, creditNote: detail, transaction: tx });
  });
}

async function list({ companyId, filters = {}, transaction = null } = {}) {
  assertCompanyId(companyId);
  const where = { companyId };
  const status = asText(filters.status);
  const invoiceId = asText(filters.invoiceId);
  const orderId = asText(filters.orderId);
  const customerId = asText(filters.customerId || filters.counterpartyId);
  const q = asText(filters.q || filters.search);
  if (status) where.status = status;
  if (invoiceId) where.invoiceId = invoiceId;
  if (orderId) where.orderId = orderId;
  if (q) {
    where[Op.or] = [
      { number: { [Op.iLike]: `%${q}%` } },
      { reason: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const include = creditNoteInclude();
  if (customerId) {
    const invoiceInclude = include.find((entry) => entry.as === 'invoice');
    const orderInclude = include.find((entry) => entry.as === 'order');
    if (invoiceInclude?.include?.[0]) {
      invoiceInclude.include[0].where = { customerId };
      invoiceInclude.include[0].required = true;
      invoiceInclude.required = true;
    }
    if (orderInclude) {
      orderInclude.where = { customerId };
      orderInclude.required = false;
    }
  }

  const rows = await CreditNote.findAll({
    where,
    include,
    order: [['createdAt', 'DESC']],
    transaction,
  });

  const dtos = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    dtos.push(await buildDetailDto({ companyId, creditNote: row, transaction }));
  }
  return dtos;
}

async function getById({ companyId, id, transaction = null } = {}) {
  const creditNote = await loadCreditNote({ companyId, id, transaction });
  return buildDetailDto({ companyId, creditNote, transaction });
}

async function apply({ companyId, creditNoteId, applications = [], userId = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  return withTransaction(transaction, async (tx) => {
    const creditNote = await CreditNote.findOne({
      where: { id: creditNoteId, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!creditNote) {
      throw new AppError(404, 'Credit note not found', { code: 'NOT_FOUND' });
    }
    if ((creditNote.status || 'issued') !== 'issued') {
      throw new AppError(409, 'Only issued credit notes can be applied', {
        code: 'CREDIT_NOTE_STATUS_INVALID',
      });
    }

    const ledgerResult = await paymentLedgerService.applyCreditNote({
      companyId,
      creditNoteId,
      applications,
      userId,
      transaction: tx,
    });
    const refreshed = await loadCreditNote({ companyId, id: creditNoteId, transaction: tx });
    return {
      creditNote: await buildDetailDto({ companyId, creditNote: refreshed, transaction: tx }),
      ledger: ledgerResult,
    };
  });
}

async function cancel({ companyId, id, userId = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  return withTransaction(transaction, async (tx) => {
    const creditNote = await CreditNote.findOne({
      where: { id, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!creditNote) {
      throw new AppError(404, 'Credit note not found', { code: 'NOT_FOUND' });
    }
    const applications = await CreditNoteApplication.findAll({
      where: { companyId, creditNoteId: creditNote.id },
      transaction: tx,
    });
    const appliedAmount = round(applications.reduce((sum, entry) => sum + asNumber(entry.amount, 0), 0), 2);
    const refundPayment = await findRefundPayment({ companyId, creditNote, transaction: tx });
    if (appliedAmount > 0 || refundPayment) {
      throw new AppError(409, 'Applied or refunded credit notes cannot be cancelled', {
        code: 'CREDIT_NOTE_ALREADY_USED',
      });
    }
    void userId;
    await creditNote.update({ status: 'cancelled' }, { transaction: tx });
    const refreshed = await loadCreditNote({ companyId, id, transaction: tx });
    return buildDetailDto({ companyId, creditNote: refreshed, transaction: tx });
  });
}

async function refund({ companyId, id, amount, method = 'bank_transfer', reference = null, userId = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  return withTransaction(transaction, async (tx) => {
    const lockedCreditNote = await CreditNote.findOne({
      where: { id, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!lockedCreditNote) {
      throw new AppError(404, 'Credit note not found', { code: 'NOT_FOUND' });
    }
    if ((lockedCreditNote.status || 'issued') !== 'issued') {
      throw new AppError(409, 'Only issued credit notes can be refunded', {
        code: 'CREDIT_NOTE_STATUS_INVALID',
      });
    }

    const creditNote = await loadCreditNote({ companyId, id, transaction: tx });
    const currentDto = await buildDetailDto({ companyId, creditNote, transaction: tx });
    const refundAmount = assertPositiveAmount(amount ?? currentDto.refundableAmount, 'amount');
    if (refundAmount > currentDto.refundableAmount) {
      throw new AppError(409, 'Credit note refund cannot exceed remaining refundable credit', {
        code: 'CREDIT_NOTE_REFUND_EXCEEDS_REMAINING',
        details: { refundableAmount: currentDto.refundableAmount, amount: refundAmount },
      });
    }

    const orderId = creditNote.orderId || creditNote.invoice?.orderId || creditNote.invoice?.order?.id || null;
    if (!orderId) {
      throw new AppError(409, 'Credit note refund requires an order context', {
        code: 'CREDIT_NOTE_REFUND_ORDER_REQUIRED',
      });
    }

    const currencyCode = creditNote.order?.currencyCode || creditNote.invoice?.order?.currencyCode || null;
    const refundReference = reference
      ? `${getRefundReferencePrefix(creditNote.id)}:${asText(reference)}`
      : getRefundReferencePrefix(creditNote.id);

    const payment = await paymentService.create({
      companyId,
      orderId,
      method: asText(method) || 'bank_transfer',
      status: 'paid',
      direction: 'refund',
      amount: refundAmount,
      currencyCode,
      reference: refundReference,
      processedAt: new Date(),
      userId,
      createdBy: userId,
    }, { transaction: tx });

    const refreshed = await loadCreditNote({ companyId, id, transaction: tx });
    const detail = await buildDetailDto({ companyId, creditNote: refreshed, transaction: tx });
    return {
      creditNote: detail,
      refundPayment: paymentSummary(payment),
      // No credit_note_id exists on payments yet; this is intentionally traceable by reference only.
      linkage: {
        type: 'reference',
        reference: refundReference,
      },
    };
  });
}

module.exports = {
  issue,
  list,
  getById,
  apply,
  cancel,
  refund,
  mapCreditNoteToDetailDto,
};
