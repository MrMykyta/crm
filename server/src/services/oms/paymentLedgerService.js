'use strict';

const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  sequelize,
  Invoice,
  Order,
  Payment,
  PaymentApplication,
  CreditNote,
  CreditNoteApplication,
} = require('../../models');

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

function isPastDate(value) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function derivePaymentState(invoice, { amountPaid = 0, amountCredited = 0, amountDue = 0, overdue = false } = {}) {
  if (!invoice?.issueDate) return 'draft';
  if (amountDue <= 0) return 'paid';
  if (amountPaid + amountCredited > 0) return overdue ? 'partially_paid_overdue' : 'partially_paid';
  return overdue ? 'overdue' : 'unpaid';
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

async function sumPaymentApplications({ companyId, paymentId = null, invoiceId = null, transaction = null } = {}) {
  const where = { companyId };
  if (paymentId) where.paymentId = paymentId;
  if (invoiceId) where.invoiceId = invoiceId;
  const rows = await PaymentApplication.findAll({
    where,
    attributes: ['id', 'paymentId', 'invoiceId', 'amount', 'allocatedAt', 'createdAt'],
    transaction,
  });
  return {
    rows,
    total: round(rows.reduce((sum, row) => sum + asNumber(row.amount, 0), 0), 2),
  };
}

async function sumCreditNoteApplications({ companyId, creditNoteId = null, invoiceId = null, transaction = null } = {}) {
  const where = { companyId };
  if (creditNoteId) where.creditNoteId = creditNoteId;
  if (invoiceId) where.invoiceId = invoiceId;
  const rows = await CreditNoteApplication.findAll({
    where,
    attributes: ['id', 'creditNoteId', 'invoiceId', 'amount', 'allocatedAt', 'createdAt'],
    transaction,
  });
  return {
    rows,
    total: round(rows.reduce((sum, row) => sum + asNumber(row.amount, 0), 0), 2),
  };
}

async function deriveInvoiceSettlement({ companyId, invoiceId, invoice = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  const row = invoice || await Invoice.findOne({
    where: { id: invoiceId, companyId },
    transaction,
  });
  if (!row) {
    throw new AppError(404, 'Invoice not found', { code: 'NOT_FOUND' });
  }

  const [paymentApps, creditApps] = await Promise.all([
    sumPaymentApplications({ companyId, invoiceId: row.id, transaction }),
    sumCreditNoteApplications({ companyId, invoiceId: row.id, transaction }),
  ]);

  const totalGross = asNumber(row.totalGross, 0);
  const amountPaid = round(Math.min(totalGross, paymentApps.total), 2);
  const amountCredited = round(Math.min(Math.max(0, totalGross - amountPaid), creditApps.total), 2);
  const amountDue = round(Math.max(0, totalGross - amountPaid - amountCredited), 2);
  const overdue = amountDue > 0 && isPastDate(row.dueDate);
  const paymentState = derivePaymentState(row, {
    amountPaid,
    amountCredited,
    amountDue,
    overdue,
  });

  return {
    invoiceId: row.id,
    orderId: row.orderId || null,
    totalGross,
    amountPaid,
    amountCredited,
    amountDue,
    overdue,
    paymentState,
    paidDateShouldBeSet: paymentState === 'paid',
    paymentApplications: paymentApps.rows,
    creditNoteApplications: creditApps.rows,
  };
}

async function refreshInvoiceAndOrderSettlement({ companyId, invoiceId, transaction = null } = {}) {
  const settlement = await deriveInvoiceSettlement({ companyId, invoiceId, transaction });
  const invoice = await Invoice.findOne({
    where: { id: invoiceId, companyId },
    transaction,
  });

  if (invoice) {
    if (settlement.paidDateShouldBeSet && !invoice.paidDate) {
      await invoice.update({ paidDate: new Date() }, { transaction });
    } else if (!settlement.paidDateShouldBeSet && invoice.paidDate) {
      await invoice.update({ paidDate: null }, { transaction });
    }
  }

  if (settlement.orderId) {
    await recomputeOrderPaymentStatus({
      companyId,
      orderId: settlement.orderId,
      transaction,
    });
  }

  return settlement;
}

async function deriveOrderPaymentStatus({ companyId, orderId, transaction = null } = {}) {
  assertCompanyId(companyId);
  const invoices = await Invoice.findAll({
    where: { companyId, orderId },
    transaction,
  });
  if (!invoices.length) {
    return {
      orderId,
      paymentStatus: 'pending',
      amountPaid: 0,
      amountCredited: 0,
      amountDue: 0,
      totalGross: 0,
      invoices: [],
    };
  }

  const settlements = [];
  for (const invoice of invoices) {
    // eslint-disable-next-line no-await-in-loop
    settlements.push(await deriveInvoiceSettlement({ companyId, invoiceId: invoice.id, invoice, transaction }));
  }

  const totalGross = round(settlements.reduce((sum, settlement) => sum + settlement.totalGross, 0), 2);
  const amountPaid = round(settlements.reduce((sum, settlement) => sum + settlement.amountPaid, 0), 2);
  const amountCredited = round(settlements.reduce((sum, settlement) => sum + settlement.amountCredited, 0), 2);
  const amountDue = round(settlements.reduce((sum, settlement) => sum + settlement.amountDue, 0), 2);
  const settledAmount = round(amountPaid + amountCredited, 2);
  let paymentStatus = 'pending';
  if (totalGross > 0 && amountDue <= 0) {
    paymentStatus = 'paid';
  } else if (settledAmount > 0) {
    paymentStatus = 'partially_paid';
  }

  return {
    orderId,
    paymentStatus,
    amountPaid,
    amountCredited,
    amountDue,
    totalGross,
    invoices: settlements,
  };
}

async function recomputeOrderPaymentStatus({ companyId, orderId, transaction = null } = {}) {
  const summary = await deriveOrderPaymentStatus({ companyId, orderId, transaction });
  await Order.update(
    { paymentStatus: summary.paymentStatus },
    { where: { id: orderId, companyId }, transaction }
  );
  return summary;
}

async function assertInvoiceCapacity({ companyId, invoiceId, amount, transaction }) {
  const settlement = await deriveInvoiceSettlement({ companyId, invoiceId, transaction });
  if (round(settlement.amountPaid + settlement.amountCredited + amount, 2) > settlement.totalGross) {
    throw new AppError(409, 'Invoice cannot be over-settled', {
      code: 'INVOICE_OVER_SETTLED',
      details: { invoiceId, amount, amountDue: settlement.amountDue },
    });
  }
  return settlement;
}

async function applyPayment({ companyId, paymentId, applications = [], userId = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  const cleanApplications = applications
    .map((entry) => ({ invoiceId: asText(entry.invoiceId), amount: assertPositiveAmount(entry.amount) }))
    .filter((entry) => entry.invoiceId);
  if (!cleanApplications.length) {
    throw new AppError(400, 'applications are required', { code: 'VALIDATION_ERROR' });
  }

  return withTransaction(transaction, async (tx) => {
    const payment = await Payment.findOne({
      where: { id: paymentId, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!payment) {
      throw new AppError(404, 'Payment not found', { code: 'NOT_FOUND' });
    }
    if (asText(payment.direction || 'inbound').toLowerCase() !== 'inbound') {
      throw new AppError(409, 'Only inbound payments can be applied to invoices', {
        code: 'PAYMENT_DIRECTION_INVALID',
      });
    }
    if (asText(payment.status).toLowerCase() !== 'paid') {
      throw new AppError(409, 'Only paid payments can be applied', {
        code: 'PAYMENT_STATUS_INVALID',
      });
    }

    const existingPaymentApps = await sumPaymentApplications({ companyId, paymentId, transaction: tx });
    const newTotal = round(cleanApplications.reduce((sum, entry) => sum + entry.amount, 0), 2);
    if (round(existingPaymentApps.total + newTotal, 2) > asNumber(payment.amount, 0)) {
      throw new AppError(409, 'Payment cannot be over-applied', {
        code: 'PAYMENT_OVER_APPLIED',
        details: { paymentId, amount: payment.amount, alreadyApplied: existingPaymentApps.total, newTotal },
      });
    }

    const invoiceIds = [...new Set(cleanApplications.map((entry) => entry.invoiceId))];
    const invoices = await Invoice.findAll({
      where: { companyId, id: { [Op.in]: invoiceIds } },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (invoices.length !== invoiceIds.length) {
      throw new AppError(400, 'applications contain an invalid invoiceId', {
        code: 'VALIDATION_ERROR',
      });
    }

    for (const invoiceId of invoiceIds) {
      const amountForInvoice = round(
        cleanApplications
          .filter((entry) => entry.invoiceId === invoiceId)
          .reduce((sum, entry) => sum + entry.amount, 0),
        2
      );
      // eslint-disable-next-line no-await-in-loop
      await assertInvoiceCapacity({ companyId, invoiceId, amount: amountForInvoice, transaction: tx });
    }

    await PaymentApplication.bulkCreate(
      cleanApplications.map((entry) => ({
        companyId,
        paymentId: payment.id,
        invoiceId: entry.invoiceId,
        amount: entry.amount,
        allocatedAt: new Date(),
        createdBy: userId || null,
      })),
      { transaction: tx }
    );

    const invoiceSettlements = [];
    for (const invoiceId of invoiceIds) {
      // eslint-disable-next-line no-await-in-loop
      invoiceSettlements.push(await refreshInvoiceAndOrderSettlement({ companyId, invoiceId, transaction: tx }));
    }

    return {
      paymentId: payment.id,
      payment: await summarizePayment({ companyId, payment, transaction: tx }),
      invoices: invoiceSettlements,
    };
  });
}

async function unapplyPayment({ companyId, applicationId, transaction = null } = {}) {
  assertCompanyId(companyId);
  return withTransaction(transaction, async (tx) => {
    const application = await PaymentApplication.findOne({
      where: { id: applicationId, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!application) {
      throw new AppError(404, 'Payment application not found', { code: 'NOT_FOUND' });
    }
    const invoiceId = application.invoiceId;
    await application.destroy({ transaction: tx });
    const settlement = await refreshInvoiceAndOrderSettlement({ companyId, invoiceId, transaction: tx });
    return { applicationId, invoice: settlement };
  });
}

async function applyCreditNote({ companyId, creditNoteId, applications = [], userId = null, transaction = null } = {}) {
  assertCompanyId(companyId);
  const cleanApplications = applications
    .map((entry) => ({ invoiceId: asText(entry.invoiceId), amount: assertPositiveAmount(entry.amount) }))
    .filter((entry) => entry.invoiceId);
  if (!cleanApplications.length) {
    throw new AppError(400, 'applications are required', { code: 'VALIDATION_ERROR' });
  }

  return withTransaction(transaction, async (tx) => {
    const creditNote = await CreditNote.findOne({
      where: { id: creditNoteId, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!creditNote) {
      throw new AppError(404, 'Credit note not found', { code: 'NOT_FOUND' });
    }

    const existingApps = await sumCreditNoteApplications({ companyId, creditNoteId, transaction: tx });
    const newTotal = round(cleanApplications.reduce((sum, entry) => sum + entry.amount, 0), 2);
    if (round(existingApps.total + newTotal, 2) > asNumber(creditNote.amountGross, 0)) {
      throw new AppError(409, 'Credit note cannot be over-applied', {
        code: 'CREDIT_NOTE_OVER_APPLIED',
      });
    }

    const invoiceIds = [...new Set(cleanApplications.map((entry) => entry.invoiceId))];
    const invoices = await Invoice.findAll({
      where: { companyId, id: { [Op.in]: invoiceIds } },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (invoices.length !== invoiceIds.length) {
      throw new AppError(400, 'applications contain an invalid invoiceId', {
        code: 'VALIDATION_ERROR',
      });
    }

    for (const invoiceId of invoiceIds) {
      const amountForInvoice = round(
        cleanApplications
          .filter((entry) => entry.invoiceId === invoiceId)
          .reduce((sum, entry) => sum + entry.amount, 0),
        2
      );
      // eslint-disable-next-line no-await-in-loop
      await assertInvoiceCapacity({ companyId, invoiceId, amount: amountForInvoice, transaction: tx });
    }

    await CreditNoteApplication.bulkCreate(
      cleanApplications.map((entry) => ({
        companyId,
        creditNoteId: creditNote.id,
        invoiceId: entry.invoiceId,
        amount: entry.amount,
        allocatedAt: new Date(),
        createdBy: userId || null,
      })),
      { transaction: tx }
    );

    const invoiceSettlements = [];
    for (const invoiceId of invoiceIds) {
      // eslint-disable-next-line no-await-in-loop
      invoiceSettlements.push(await refreshInvoiceAndOrderSettlement({ companyId, invoiceId, transaction: tx }));
    }

    return {
      creditNoteId: creditNote.id,
      invoices: invoiceSettlements,
    };
  });
}

async function summarizePayment({ companyId, payment, transaction = null } = {}) {
  const apps = await sumPaymentApplications({ companyId, paymentId: payment.id, transaction });
  const amount = asNumber(payment.amount, 0);
  const allocatedAmount = round(apps.total, 2);
  return {
    allocatedAmount,
    unappliedAmount: round(Math.max(0, amount - allocatedAmount), 2),
    applications: apps.rows,
  };
}

async function summarizePayments({ companyId, payments = [], transaction = null } = {}) {
  const paymentIds = payments.map((payment) => payment.id).filter(Boolean);
  if (!paymentIds.length) return new Map();
  const rows = await PaymentApplication.findAll({
    where: { companyId, paymentId: { [Op.in]: paymentIds } },
    transaction,
  });
  const totals = new Map(paymentIds.map((id) => [String(id), { allocatedAmount: 0, applications: [] }]));
  rows.forEach((row) => {
    const key = String(row.paymentId);
    const current = totals.get(key) || { allocatedAmount: 0, applications: [] };
    current.allocatedAmount = round(current.allocatedAmount + asNumber(row.amount, 0), 2);
    current.applications.push(row);
    totals.set(key, current);
  });
  payments.forEach((payment) => {
    const key = String(payment.id);
    const current = totals.get(key) || { allocatedAmount: 0, applications: [] };
    const amount = asNumber(payment.amount, 0);
    current.unappliedAmount = round(Math.max(0, amount - current.allocatedAmount), 2);
    totals.set(key, current);
  });
  return totals;
}

async function listCreditNotesForInvoice({ companyId, invoiceId, transaction = null } = {}) {
  return CreditNote.findAll({
    where: { companyId, invoiceId },
    include: [
      {
        model: CreditNoteApplication,
        as: 'applications',
        required: false,
        where: { invoiceId },
      },
    ],
    order: [['createdAt', 'ASC']],
    transaction,
  });
}

module.exports = {
  applyPayment,
  unapplyPayment,
  applyCreditNote,
  deriveInvoiceSettlement,
  deriveOrderPaymentStatus,
  recomputeOrderPaymentStatus,
  summarizePayment,
  summarizePayments,
  listCreditNotesForInvoice,
};
