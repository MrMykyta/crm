// receipt.commands.router.js
// Mounted at /api/wms/receipts (see rootRouter.js).
const r = require('express').Router();
const c = require('../../controllers/wms/receipt.controller');

r.get('/', c.list);
r.get('/item/:itemId/stock-moves', c.listItemStockMoves);
r.get('/:id/stock-moves', c.listStockMoves);
r.get('/:id/print', c.getPrint);
r.get('/:id', c.getById);
r.post('/', c.create);
r.post('/item/:itemId/receive', c.receiveLine);
r.post('/:id/correction', c.createCorrection); // K1.3 — PZK

module.exports = r;
