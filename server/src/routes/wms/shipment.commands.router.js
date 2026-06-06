
// shipment.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/shipment.controller');

r.post('/', c.create);
r.post('/item/:itemId/ship', c.shipItem);
r.post('/:id/correction', c.createCorrection); // K1.3 — WZK

module.exports = r;
