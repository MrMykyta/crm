const crypto = require('crypto');
const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Order, OrderItem, Counterparty } = require('../../models');
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
  return {
    id: order.id,
    number: order.number || null,
    status: order.status || null,
    counterparty: counterpartyDto(order),
  };
}

function invoiceItemDto(item) {
  const raw = typeof item?.toJSON === 'function' ? item.toJSON() : (item || {});
  return {
    ...raw,
    lineType: raw.lineType || 'custom',
  };
}

function invoiceDto(invoice, { includeItems = false } = {}) {
  if (!invoice) return null;
  const raw = typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;
  const dto = {
    ...raw,
    status: raw.status || deriveInvoiceStatus(raw),
    counterparty: counterpartyDto(raw.order),
    order: orderDto(raw.order),
  };
  if (includeItems) {
    dto.items = Array.isArray(raw.items) ? raw.items.map(invoiceItemDto) : [];
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
  const invoice = await Invoice.findOne({
    where: { id, companyId },
    include: [
      { model: InvoiceItem, as: 'items', required: false },
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
    order: [[{ model: InvoiceItem, as: 'items' }, 'sortOrder', 'ASC']],
  });
  return invoiceDto(invoice, { includeItems: true });
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
