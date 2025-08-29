
// receipt.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/receipt.controller');

r.post('/', c.create);
r.post('/item/:itemId/receive', c.receiveLine);

module.exports = r;
