// scripts/scaffold-wms.js
// Генерит services/controllers/routes для WMS в стиле твоего CRM.
// Запуск: node scripts/scaffold-wms.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'src');
const SERVICES_DIR    = path.join(SRC, 'services', 'wms');
const CONTROLLERS_DIR = path.join(SRC, 'controllers', 'wms');
const ROUTES_DIR      = path.join(SRC, 'routes', 'wms');

// kind: только 'crud' (команды генерим отдельными шаблонами ниже)
const ENTITIES = [
  { name:'warehouse', model:'Warehouse', path:'warehouses', sort:'createdAt:desc', search:['code','name'], filters:['isActive'], kind:'crud' },
  { name:'location',  model:'Location',  path:'locations',  sort:'createdAt:desc', search:['code','name'], filters:['warehouseId','type'], kind:'crud',
    include:[ "{ model: Warehouse, as:'warehouse' }" ] },

  { name:'lot',     model:'Lot',     path:'lots',     sort:'createdAt:desc', search:['lotNumber'],   filters:['productId'], kind:'crud' },
  { name:'serial',  model:'Serial',  path:'serials',  sort:'createdAt:desc', search:['serialNumber'],filters:['productId'], kind:'crud' },

  { name:'inventoryItem', model:'InventoryItem', path:'inventory-items', sort:'updatedAt:desc', search:[], filters:['warehouseId','locationId','productId','variantId','lotId','serialId'], kind:'crud',
    include:[ "{ model: Warehouse, as:'warehouse' }", "{ model: Location, as:'location' }", "{ model: Product, as:'product' }", "{ model: ProductVariant, as:'variant' }" ] },

  { name:'reservation', model:'Reservation', path:'reservations', sort:'createdAt:desc', search:[], filters:['warehouseId','status','productId','variantId'], kind:'crud' },

  { name:'stockMove', model:'StockMove', path:'stock-moves', sort:'createdAt:desc', search:[], filters:['warehouseId','type','productId','variantId','refType','refId','locationId'], kind:'crud',
    include:[ "{ model: Warehouse, as:'warehouse' }", "{ model: Location, as:'location' }", "{ model: Product, as:'product' }", "{ model: ProductVariant, as:'variant' }" ] },

  { name:'receipt',     model:'Receipt',     path:'receipts',     sort:'createdAt:desc', search:['number'], filters:['warehouseId','status'], kind:'crud',
    include:[ "{ model: ReceiptItem, as:'items' }" ] },
  { name:'receiptItem', model:'ReceiptItem', path:'receipt-items',sort:'createdAt:desc', search:[], filters:['receiptId','productId','variantId'], kind:'crud' },

  { name:'transferOrder', model:'TransferOrder', path:'transfers', sort:'createdAt:desc', search:['number'], filters:['fromWarehouseId','toWarehouseId','status'], kind:'crud',
    include:[ "{ model: TransferItem, as:'items' }" ] },
  { name:'transferItem',  model:'TransferItem',  path:'transfer-items', sort:'createdAt:desc', search:[], filters:['transferId','productId','variantId'], kind:'crud' },

  { name:'pickWave', model:'PickWave', path:'pick-waves', sort:'createdAt:desc', search:[], filters:['warehouseId','status'], kind:'crud',
    include:[ "{ model: PickTask, as:'tasks' }" ] },
  { name:'pickTask', model:'PickTask', path:'pick-tasks', sort:'createdAt:desc', search:[], filters:['waveId','orderId','status','fromLocationId'], kind:'crud' },

  { name:'shipment',     model:'Shipment',     path:'shipments',     sort:'createdAt:desc', search:['number'], filters:['warehouseId','orderId','status'], kind:'crud',
    include:[ "{ model: ShipmentItem, as:'items' }" ] },
  { name:'shipmentItem', model:'ShipmentItem', path:'shipment-items',sort:'createdAt:desc', search:[], filters:['shipmentId','productId','variantId'], kind:'crud' },
  { name:'parcel',       model:'Parcel',       path:'parcels',       sort:'createdAt:desc', search:['trackingNumber','carrier'], filters:['shipmentId'], kind:'crud' },

  { name:'adjustment',     model:'Adjustment',     path:'adjustments',     sort:'createdAt:desc', search:['reason'], filters:['warehouseId','type'], kind:'crud',
    include:[ "{ model: AdjustmentItem, as:'items' }" ] },
  { name:'adjustmentItem', model:'AdjustmentItem', path:'adjustment-items',sort:'createdAt:desc', search:[], filters:['adjustmentId','productId','variantId','locationId'], kind:'crud' },

  { name:'cycleCount', model:'CycleCount', path:'cycle-counts', sort:'createdAt:desc', search:[], filters:['warehouseId','status'], kind:'crud',
    include:[ "{ model: CountItem, as:'items' }" ] },
  { name:'countItem',  model:'CountItem',  path:'count-items',  sort:'createdAt:desc', search:[], filters:['countId','locationId','productId','variantId'], kind:'crud' },
];

// === helpers ===
function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); }
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function camelToModelField(k){ return k; }
function includeModelImports(includeArr){
  if (!includeArr || !includeArr.length) return '';
  const names = includeArr.map(s=>{ const m = s.match(/model:\s*([A-Za-z0-9_]+)/); return m ? m[1] : null; }).filter(Boolean);
  const uniq = [...new Set(names)];
  return uniq.length ? ', ' + uniq.join(', ') : '';
}

// === CRUD template ===
function serviceCrudTemplate({ name, model, search = [], filters = [], sort, include = [] }) {
  const hasSearch = Array.isArray(search) && search.length > 0;
  const searchOr = hasSearch
    ? `where[Op.or] = [${search.map(f => `{ ${f}: { [Op.iLike]: \`%\${query.q}%\` } }`).join(', ')}];`
    : '';
  const filterLines = (filters || []).map(f => `  if (query.${f}) where.${camelToModelField(f)} = query.${f};`).join('\n');
  const includeArr = include.length ? `include: [${include.join(', ')}],` : '';
  const defaultSort = sort || 'createdAt:desc';

  return `
// ${name}Service.js (generated)
const { Op } = require('sequelize');
const { ${model}${includeModelImports(include)} } = require('../../models');

const parsePaging = (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildOrder = (query = {}) => {
  const sort = String(query.sort || '${defaultSort}').split(',').filter(Boolean);
  if (!sort.length) return [['createdAt', 'DESC']];
  return sort.map(s => { const [f,d] = s.split(':'); return [f, (d || 'asc').toUpperCase()]; });
};

const buildWhere = (query = {}, user = {}) => {
  const where = {};
  if (query.companyId) where.companyId = query.companyId;
  else if (user?.companyId) where.companyId = user.companyId;
${filterLines || '  // no extra filters'}
${hasSearch ? `  if (query.q) { ${searchOr} }` : '  // no free-text search'}
  return where;
};

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await ${model}.findAndCountAll({ where, ${includeArr} order, limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = async (id) => id ? ${model}.findByPk(id, { ${includeArr} }) : null;

module.exports.create  = async (payload = {}) => {
  if (!payload.companyId) throw new Error('companyId is required');
  return ${model}.create(payload);
};

module.exports.update  = async (id, payload = {}) => {
  if (!id) throw new Error('id is required');
  const row = await ${model}.findByPk(id); if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return module.exports.getById(id);
};

module.exports.remove  = async (id) => id ? ${model}.destroy({ where:{ id } }) : 0;
`;
}

function controllerCrudTemplate({ name }) {
  const ctrlName = cap(name);
  return `
// ${ctrlName}.controller.js (generated)
const ${name}Service = require('../../services/wms/${name}Service');

module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await ${name}Service.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[${ctrlName}Controller.list]', e); res.status(400).send({ error: e.message }); }
};

module.exports.getById = async (req, res) => {
  try {
    const item = await ${name}Service.getById(req.params.id);
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[${ctrlName}Controller.getById]', e); res.status(400).send({ error: e.message }); }
};

module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
    const created = await ${name}Service.create(payload);
    res.status(201).send(created);
  } catch (e) { console.error('[${ctrlName}Controller.create]', e); res.status(400).send({ error: e.message }); }
};

module.exports.update = async (req, res) => {
  try {
    const updated = await ${name}Service.update(req.params.id, req.body);
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[${ctrlName}Controller.update]', e); res.status(400).send({ error: e.message }); }
};

module.exports.remove = async (req, res) => {
  try {
    const n = await ${name}Service.remove(req.params.id);
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[${ctrlName}Controller.remove]', e); res.status(400).send({ error: e.message }); }
};
`;
}

function routerCrudTemplate({ name }) {
  return `
// ${name}.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/${name}.controller');

r.get('/', c.list);
r.get('/:id', c.getById);
r.post('/', c.create);
r.put('/:id', c.update);
r.delete('/:id', c.remove);

module.exports = r;
`;
}

// === Extra services (domain commands) ===
function serviceInventoryTemplate() {
  return `
// inventoryService.js (generated)
const { withTx } = require('../../utils/tx');
const { withCompany } = require('../../utils/withCompany');
const { sequelize, InventoryItem, Reservation, StockMove } = require('../../models');

module.exports.getOnHand = async (companyId, { warehouseId, productId, variantId, locationId=null, lotId=null }) => {
  const where = withCompany(companyId, { warehouseId, productId, variantId });
  if (locationId) where.locationId = locationId;
  if (lotId) where.lotId = lotId;
  const rows = await InventoryItem.findAll({ where });
  const onHand = rows.reduce((s,r)=> s + (Number(r.qty||0) - Number(r.reservedQty||0)), 0);
  return { onHand, rows };
};

module.exports.reserve = async (companyId, { warehouseId, items=[], orderRef }, outerTx=null) => {
  return withTx(async (t) => {
    if (!companyId) throw new Error('companyId is required');
    if (!warehouseId) throw new Error('warehouseId is required');
    if (!Array.isArray(items) || !items.length) throw new Error('items is required');

    const created = [];
    for (const it of items) {
      const where = withCompany(companyId, {
        warehouseId,
        locationId: it.locationId || null,
        productId: it.productId || null,
        variantId: it.variantId || null,
        lotId: it.lotId || null,
        serialId: it.serialId || null,
      });
      const r = await Reservation.create({ ...where, qty: Number(it.qty||0), status:'reserved', orderRef }, { transaction:t });
      created.push(r);
    }
    return created;
  }, outerTx);
};

module.exports.releaseReservation = async (companyId, reservationId, outerTx=null) => {
  return withTx(async (t) => {
    const r = await Reservation.findOne({ where: withCompany(companyId,{ id: reservationId }), transaction:t });
    if (!r) return null;
    await r.update({ status:'released' }, { transaction:t });
    return r;
  }, outerTx);
};

module.exports.applyMove = async (companyId, { warehouseId, productId, variantId, qty, fromLocationId=null, toLocationId=null, lotId=null, serialId=null, reason='move' }, outerTx=null) => {
  return withTx(async (t) => {
    const writeInv = async (locationId, delta) => {
      const where = withCompany(companyId, { warehouseId, productId, variantId, locationId, lotId, serialId });
      const inv = await InventoryItem.findOne({ where, transaction:t });
      if (inv) await inv.update({ qty: sequelize.literal(\`qty + \${delta}\`) }, { transaction:t });
      else     await InventoryItem.create({ ...where, qty: delta }, { transaction:t });
    };
    const q = Number(qty||0);
    if (fromLocationId) await writeInv(fromLocationId, -q);
    if (toLocationId)   await writeInv(toLocationId,   q);

    await StockMove.create({ companyId, type: fromLocationId && toLocationId ? 'TRANSFER' : (fromLocationId ? 'OUT' : 'IN'), warehouseId, locationId: toLocationId || fromLocationId, productId, variantId, lotId, serialId, qty:q, refType:'manual', refId:null, reason }, { transaction:t });
    return { ok:true };
  }, outerTx);
};
`;
}

function serviceReceiptTemplate() {
  return `
// receiptService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Receipt, ReceiptItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return withTx(async (t) => {
    const { items=[], ...core } = data;
    const receipt = await Receipt.create({ ...core, companyId, status:'open' }, { transaction:t });
    if (items.length) {
      await ReceiptItem.bulkCreate(items.map(i=>({ ...i, companyId, receiptId: receipt.id, receivedQty:0 })), { transaction:t });
    }
    return Receipt.findOne({ where:{ id: receipt.id, companyId }, include:[{ model: ReceiptItem, as:'items' }], transaction:t });
  }, outerTx);
};

module.exports.receiveLine = async (companyId, receiptItemId, { qty, toLocationId, lotId=null, serialId=null }, outerTx=null) => {
  return withTx(async (t) => {
    const item = await ReceiptItem.findOne({ where:{ companyId, id: receiptItemId }, transaction:t });
    if (!item) return null;
    await Inventory.applyMove(companyId, {
      warehouseId: item.warehouseId, productId: item.productId, variantId: item.variantId,
      qty, toLocationId, lotId, serialId, reason:'receipt'
    }, t);
    const receivedQty = Number(item.receivedQty||0) + Number(qty||0);
    await item.update({ receivedQty, status: receivedQty >= Number(item.qty||0) ? 'received' : 'partial' }, { transaction:t });
    const others = await ReceiptItem.findAll({ where:{ companyId, receiptId: item.receiptId }, transaction:t });
    const done = others.every(i => Number(i.receivedQty||0) >= Number(i.qty||0));
    if (done) await Receipt.update({ status:'received' }, { where:{ companyId, id: item.receiptId }, transaction:t });
    return item;
  }, outerTx);
};
`;
}

function servicePickTemplate() {
  return `
// pickService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { PickWave, PickTask, Reservation } = require('../../models');

module.exports.createWave = async (companyId, { warehouseId, reservations=[], reference }, outerTx=null) => {
  return withTx(async (t) => {
    const wave = await PickWave.create({ companyId, warehouseId, reference, status:'open' }, { transaction:t });
    for (const rId of reservations) {
      const r = await Reservation.findOne({ where:{ companyId, id: rId }, transaction:t });
      if (!r || r.status !== 'reserved') continue;
      await PickTask.create({ companyId, waveId: wave.id, reservationId: r.id, status:'open', qty: r.qty }, { transaction:t });
    }
    return wave;
  }, outerTx);
};

module.exports.completeTask = async (companyId, taskId, outerTx=null) => {
  return withTx(async (t) => {
    const task = await PickTask.findOne({ where:{ companyId, id: taskId }, include:[{ model: Reservation }], transaction:t });
    if (!task) return null;
    const r = task.reservation;
    await Inventory.applyMove(companyId, {
      warehouseId: r.warehouseId, productId: r.productId, variantId: r.variantId,
      qty: r.qty, fromLocationId: r.locationId, toLocationId: r.pickToLocationId || null, lotId: r.lotId, serialId: r.serialId, reason:'pick'
    }, t);
    await task.update({ status:'done' }, { transaction:t });
    await r.update({ status:'picked' }, { transaction:t });
    return task;
  }, outerTx);
};
`;
}

function serviceShipmentTemplate() {
  return `
// shipmentService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Shipment, ShipmentItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return withTx(async (t) => {
    const { items=[], ...core } = data;
    const ship = await Shipment.create({ ...core, companyId, status:'open' }, { transaction:t });
    if (items.length) {
      await ShipmentItem.bulkCreate(items.map(i=>({ ...i, companyId, shipmentId: ship.id, shippedQty:0 })), { transaction:t });
    }
    return ship;
  }, outerTx);
};

module.exports.shipItem = async (companyId, shipmentItemId, { qty, fromLocationId, lotId=null, serialId=null }, outerTx=null) => {
  return withTx(async (t) => {
    const item = await ShipmentItem.findOne({ where:{ companyId, id: shipmentItemId }, transaction:t });
    if (!item) return null;
    await Inventory.applyMove(companyId, {
      warehouseId: item.warehouseId, productId: item.productId, variantId: item.variantId,
      qty, fromLocationId, lotId, serialId, reason:'shipment'
    }, t);
    const shippedQty = Number(item.shippedQty||0) + Number(qty||0);
    await item.update({ shippedQty }, { transaction:t });
    return item;
  }, outerTx);
};
`;
}

function serviceTransferTemplate() {
  return `
// transferService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { TransferOrder, TransferItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return withTx(async (t) => {
    const { items=[], ...core } = data;
    const order = await TransferOrder.create({ ...core, companyId, status:'open' }, { transaction:t });
    if (items.length) {
      await TransferItem.bulkCreate(items.map(i=>({ ...i, companyId, transferOrderId: order.id, movedQty:0 })), { transaction:t });
    }
    return order;
  }, outerTx);
};

module.exports.executeLine = async (companyId, transferItemId, { fromLocationId, toLocationId, qty }, outerTx=null) => {
  return withTx(async (t) => {
    const item = await TransferItem.findOne({ where:{ companyId, id: transferItemId }, transaction:t });
    if (!item) return null;
    await Inventory.applyMove(companyId, { warehouseId: item.fromWarehouseId, productId: item.productId, variantId: item.variantId, qty, fromLocationId, reason:'transfer-out' }, t);
    await Inventory.applyMove(companyId, { warehouseId: item.toWarehouseId,   productId: item.productId, variantId: item.variantId, qty, toLocationId,   reason:'transfer-in'  }, t);
    const moved = Number(item.movedQty||0) + Number(qty||0);
    await item.update({ movedQty: moved }, { transaction:t });
    return item;
  }, outerTx);
};
`;
}

function serviceAdjustmentTemplate() {
  return `
// adjustmentService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Adjustment, AdjustmentItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return withTx(async (t) => {
    const { items=[], ...core } = data;
    const adj = await Adjustment.create({ ...core, companyId, status:'open' }, { transaction:t });
    for (const it of items) {
      await AdjustmentItem.create({ ...it, companyId, adjustmentId: adj.id }, { transaction:t });
      const diff = Number(it.qtyDiff||0);
      if (diff !== 0) {
        await Inventory.applyMove(companyId, {
          warehouseId: core.warehouseId, productId: it.productId, variantId: it.variantId,
          qty: Math.abs(diff),
          fromLocationId: diff < 0 ? it.locationId : null,
          toLocationId:   diff > 0 ? it.locationId : null,
          lotId: it.lotId, serialId: it.serialId, reason:'adjustment'
        }, t);
      }
    }
    await adj.update({ status:'done' }, { transaction:t });
    return adj;
  }, outerTx);
};
`;
}

// === Controllers (commands) ===
const controllerInventory = `
// inventory.controller.js (generated)
const svc = require('../../services/wms/inventoryService');

module.exports.onHand = async (req,res)=> {
  const data = await svc.getOnHand(req.user?.companyId || req.query.companyId, req.query);
  res.status(200).send(data);
};
module.exports.reserve = async (req,res)=> {
  const rows = await svc.reserve(req.user?.companyId || req.body.companyId, req.body);
  res.status(200).send({ reserved: rows.length, rows });
};
module.exports.release = async (req,res)=> {
  const row = await svc.releaseReservation(req.user?.companyId || req.body.companyId, req.params.id);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
`;

const controllerReceipt = `
// receipt.controller.js (generated)
const svc = require('../../services/wms/receiptService');

module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
  const row = await svc.create(payload.companyId, payload);
  res.status(201).send(row);
};
module.exports.receiveLine = async (req,res)=> {
  const row = await svc.receiveLine(req.user?.companyId || req.body.companyId, req.params.itemId, req.body);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
`;

const controllerPick = `
// pick.controller.js (generated)
const svc = require('../../services/wms/pickService');

module.exports.createWave = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.createWave(req.user?.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
module.exports.completeTask = async (req,res)=> {
  const row = await svc.completeTask(req.user?.companyId || req.body.companyId, req.params.id);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
`;

const controllerShipment = `
// shipment.controller.js (generated)
const svc = require('../../services/wms/shipmentService');

module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.create(req.user?.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
module.exports.shipItem = async (req,res)=> {
  const row = await svc.shipItem(req.user?.companyId || req.body.companyId, req.params.itemId, req.body);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
`;

const controllerTransfer = `
// transfer.controller.js (generated)
const svc = require('../../services/wms/transferService');

module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.create(req.user?.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
module.exports.executeLine = async (req,res)=> {
  const row = await svc.executeLine(req.user?.companyId || req.body.companyId, req.params.itemId, req.body);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
`;

const controllerAdjustment = `
// adjustment.controller.js (generated)
const svc = require('../../services/wms/adjustmentService');

module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.create(req.user?.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
`;

// === Routers (commands) ===
const routerInventory = `
// inventory.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/inventory.controller');

r.get('/onhand', c.onHand);
r.post('/reserve', c.reserve);
r.post('/reservation/:id/release', c.release);

module.exports = r;
`;

const routerReceipt = `
// receipt.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/receipt.controller');

r.post('/', c.create);
r.post('/item/:itemId/receive', c.receiveLine);

module.exports = r;
`;

const routerPick = `
// pick.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/pick.controller');

r.post('/wave', c.createWave);
r.post('/task/:id/complete', c.completeTask);

module.exports = r;
`;

const routerShipment = `
// shipment.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/shipment.controller');

r.post('/', c.create);
r.post('/item/:itemId/ship', c.shipItem);

module.exports = r;
`;

const routerTransfer = `
// transfer.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/transfer.controller');

r.post('/', c.create);
r.post('/item/:itemId/execute', c.executeLine);

module.exports = r;
`;

const routerAdjustment = `
// adjustment.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/adjustment.controller');

r.post('/', c.create);

module.exports = r;
`;

// === index routes ===
function indexRoutesTemplate(items) {
  const lines = [
    "const { Router } = require('express');",
    "const router = Router();",
    "",
    "router.use('/inventory',   require('./inventory.commands.router'));",
    "router.use('/receipts',    require('./receipt.commands.router'));",
    "router.use('/pick',        require('./pick.commands.router'));",
    "router.use('/shipments',   require('./shipment.commands.router'));",
    "router.use('/transfers',   require('./transfer.commands.router'));",
    "router.use('/adjustments', require('./adjustment.commands.router'));",
    "",
  ];
  items.filter(e => e.kind === 'crud')
       .forEach(e => lines.push(`router.use('/${e.path}', require('./${e.name}.router'));`));
  lines.push("", "module.exports = router;", "");
  return lines.join('\n');
}

// === generate ===
ensureDir(SERVICES_DIR);
ensureDir(CONTROLLERS_DIR);
ensureDir(ROUTES_DIR);

// CRUD files
for (const e of ENTITIES.filter(x=>x.kind==='crud')) {
  const svcPath  = path.join(SERVICES_DIR,    `${e.name}Service.js`);
  const ctrlPath = path.join(CONTROLLERS_DIR, `${e.name}.controller.js`);
  const rPath    = path.join(ROUTES_DIR,      `${e.name}.router.js`);

  if (!fs.existsSync(svcPath))  fs.writeFileSync(svcPath,  serviceCrudTemplate(e),  'utf8');
  if (!fs.existsSync(ctrlPath)) fs.writeFileSync(ctrlPath, controllerCrudTemplate(e),'utf8');
  if (!fs.existsSync(rPath))    fs.writeFileSync(rPath,    routerCrudTemplate(e),   'utf8');
  console.log('✔ generated CRUD', e.name);
}

// Commands: inventory
if (!fs.existsSync(path.join(SERVICES_DIR,'inventoryService.js')))
  fs.writeFileSync(path.join(SERVICES_DIR,'inventoryService.js'), serviceInventoryTemplate(), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR,'inventory.controller.js')))
  fs.writeFileSync(path.join(CONTROLLERS_DIR,'inventory.controller.js'), controllerInventory, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR,'inventory.commands.router.js')))
  fs.writeFileSync(path.join(ROUTES_DIR,'inventory.commands.router.js'), routerInventory, 'utf8');

// Commands: receipt
if (!fs.existsSync(path.join(SERVICES_DIR,'receiptService.js')))
  fs.writeFileSync(path.join(SERVICES_DIR,'receiptService.js'), serviceReceiptTemplate(), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR,'receipt.controller.js')))
  fs.writeFileSync(path.join(CONTROLLERS_DIR,'receipt.controller.js'), controllerReceipt, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR,'receipt.commands.router.js')))
  fs.writeFileSync(path.join(ROUTES_DIR,'receipt.commands.router.js'), routerReceipt, 'utf8');

// Commands: pick
if (!fs.existsSync(path.join(SERVICES_DIR,'pickService.js')))
  fs.writeFileSync(path.join(SERVICES_DIR,'pickService.js'), servicePickTemplate(), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR,'pick.controller.js')))
  fs.writeFileSync(path.join(CONTROLLERS_DIR,'pick.controller.js'), controllerPick, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR,'pick.commands.router.js')))
  fs.writeFileSync(path.join(ROUTES_DIR,'pick.commands.router.js'), routerPick, 'utf8');

// Commands: shipment
if (!fs.existsSync(path.join(SERVICES_DIR,'shipmentService.js')))
  fs.writeFileSync(path.join(SERVICES_DIR,'shipmentService.js'), serviceShipmentTemplate(), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR,'shipment.controller.js')))
  fs.writeFileSync(path.join(CONTROLLERS_DIR,'shipment.controller.js'), controllerShipment, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR,'shipment.commands.router.js')))
  fs.writeFileSync(path.join(ROUTES_DIR,'shipment.commands.router.js'), routerShipment, 'utf8');

// Commands: transfer
if (!fs.existsSync(path.join(SERVICES_DIR,'transferService.js')))
  fs.writeFileSync(path.join(SERVICES_DIR,'transferService.js'), serviceTransferTemplate(), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR,'transfer.controller.js')))
  fs.writeFileSync(path.join(CONTROLLERS_DIR,'transfer.controller.js'), controllerTransfer, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR,'transfer.commands.router.js')))
  fs.writeFileSync(path.join(ROUTES_DIR,'transfer.commands.router.js'), routerTransfer, 'utf8');

// Commands: adjustment
if (!fs.existsSync(path.join(SERVICES_DIR,'adjustmentService.js')))
  fs.writeFileSync(path.join(SERVICES_DIR,'adjustmentService.js'), serviceAdjustmentTemplate(), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR,'adjustment.controller.js')))
  fs.writeFileSync(path.join(CONTROLLERS_DIR,'adjustment.controller.js'), controllerAdjustment, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR,'adjustment.commands.router.js')))
  fs.writeFileSync(path.join(ROUTES_DIR,'adjustment.commands.router.js'), routerAdjustment, 'utf8');

// index
const idxPath = path.join(ROUTES_DIR, 'index.js');
fs.writeFileSync(idxPath, indexRoutesTemplate(ENTITIES), 'utf8');
console.log('✔ WMS routes index generated');
