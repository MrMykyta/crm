
// shipment.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/shipment.controller');
const acl = require('./acl');

r.post('/', acl.documentCreate, c.create);
r.post('/item/:itemId/ship', acl.documentPost, c.shipItem);
r.post('/:id/correction', acl.documentCorrect, c.createCorrection); // K1.3 — WZK

module.exports = r;
