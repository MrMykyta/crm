
// inventory.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/inventory.controller');

r.get('/onhand', c.onHand);
r.post('/reserve', c.reserve);
r.post('/reservation/:id/release', c.release);

module.exports = r;
