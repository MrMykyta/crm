
// receipt.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/receipt.controller');
const acl = require('./acl');

r.get('/', acl.read, c.list);
r.get('/item/:itemId/stock-moves', acl.inventoryRead, c.listItemStockMoves);
r.get('/:id/stock-moves', acl.inventoryRead, c.listStockMoves);
r.get('/:id/print', acl.read, c.getPrint);
r.get('/:id', acl.read, c.getById);
r.post('/', acl.documentCreate, c.create);
r.post('/item/:itemId/receive', acl.documentPost, c.receiveLine);

module.exports = r;
