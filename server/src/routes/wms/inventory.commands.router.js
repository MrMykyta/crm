
// inventory.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/inventory.controller');
const acl = require('./acl');

r.get('/onhand', acl.inventoryRead, c.onHand);
r.get('/stock-balances', acl.inventoryRead, c.stockBalances);
r.post('/reserve', acl.reservationManage, c.reserve);
r.post('/reservation/:id/release', acl.reservationManage, c.release);

module.exports = r;
