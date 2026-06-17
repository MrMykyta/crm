const { createAdjustmentAdapter } = require('./adjustment.adapter');
const { createCycleCountAdapter } = require('./cycleCount.adapter');
const { createReceiptAdapter } = require('./receipt.adapter');
const { createShipmentAdapter } = require('./shipment.adapter');
const { createTransferAdapter } = require('./transfer.adapter');
const adapterTypes = require('./adapterTypes');
const errorMapping = require('./errorMapping');
const payloadBuilders = require('./payloadBuilders');
const resultMapping = require('./resultMapping');

function createDocumentAdapterRegistry({ triggers = {}, permissions } = {}) {
  const registry = {
    receipt: createReceiptAdapter({ triggers: triggers.receipt || triggers, permissions }),
    shipment: createShipmentAdapter({ triggers: triggers.shipment || triggers, permissions }),
    transfer: createTransferAdapter({ triggers: triggers.transfer || triggers, permissions }),
    adjustment: createAdjustmentAdapter({ triggers: triggers.adjustment || triggers, permissions }),
    cycleCount: createCycleCountAdapter({ triggers: triggers.cycleCount || triggers, permissions }),
  };

  return {
    get(kindKey) {
      return registry[kindKey] || null;
    },
    has(kindKey) {
      return Boolean(registry[kindKey]);
    },
    keys() {
      return Object.keys(registry);
    },
    all() {
      return { ...registry };
    },
  };
}

module.exports = {
  ...adapterTypes,
  ...errorMapping,
  ...payloadBuilders,
  ...resultMapping,
  createAdjustmentAdapter,
  createCycleCountAdapter,
  createDocumentAdapterRegistry,
  createReceiptAdapter,
  createShipmentAdapter,
  createTransferAdapter,
};
