
// shipment.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/shipment.controller');

r.post('/', c.create);
r.post('/item/:itemId/ship', c.shipItem);

module.exports = r;
