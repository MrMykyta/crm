const { Invoice, Order } = require('../../models');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');
const {
  getCompanyInvoiceSettingsForUsage,
  resolveNumberingTypeForInvoiceDefaults,
  shouldCreateWarehouseDocument,
} = require('../crm/companyInvoiceSettingsService');
const {
  getCompanyWarehouseDocumentSettingsForUsage,
} = require('../crm/companyWarehouseDocumentSettingsService');

// issue: проверяет бизнес-условие и возвращает boolean.
module.exports.issue = async (orderId, payload={}) => {
    const t = await Invoice.sequelize.transaction();
    try {
        const order = await Order.findByPk(orderId, { transaction:t });
        if (!order) throw new Error('Order not found');
        const invoiceSettings = await getCompanyInvoiceSettingsForUsage({
          companyId: order.companyId,
          transaction: t,
        });
        const numberingMeta = resolveNumberingTypeForInvoiceDefaults(invoiceSettings);

        const issueDateSource = payload.issueDate || new Date();
        const issueDate = new Date(issueDateSource);
        if (Number.isNaN(issueDate.getTime())) {
          throw new Error('issueDate is invalid');
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
          throw new Error('dueDate is invalid');
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

        await t.commit();
        return inv;
    } catch (e) { 
        await t.rollback(); 
        throw e; 
    }
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (q={}) => Invoice.findAll({ where:q, order:[['createdAt','DESC']] });

// get: возвращает данные по входным параметрам сервиса.
module.exports.get  = async (id) => Invoice.findByPk(id);

// cancel: переводит счёт в статус cancelled.
module.exports.cancel = async (id, payload={}) => {
    const inv = await Invoice.findByPk(id);
    if (!inv) {
        throw new Error('Invoice not found');
    }
    // мягкая отмена без редактирования финансовых сумм
    return inv.update({ status: 'cancelled', cancelledAt: new Date(), ...payload });
};
