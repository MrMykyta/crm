
// receipt.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/receipt.controller');

r.get('/', c.list);
r.get('/item/:itemId/stock-moves', c.listItemStockMoves);
r.get('/:id/stock-moves', c.listStockMoves);
r.get('/:id/print', c.getPrint);
r.get('/:id', c.getById);
r.post('/', c.create);
r.post('/item/:itemId/receive', c.receiveLine);

module.exports = r;
