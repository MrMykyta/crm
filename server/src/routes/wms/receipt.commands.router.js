// receipt.commands.router.js
// Mounted at /api/wms/receipts (see rootRouter.js).
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
r.patch('/:id', acl.documentUpdate, c.updateDraft);
r.post('/:id/items', acl.documentUpdate, c.addDraftItem);
r.patch('/:id/items/:itemId', acl.documentUpdate, c.updateDraftItem);
r.delete('/:id/items/:itemId', acl.documentUpdate, c.removeDraftItem);
r.post('/:id/correction', acl.documentCorrect, c.createCorrection); // K1.3 — PZK

module.exports = r;
