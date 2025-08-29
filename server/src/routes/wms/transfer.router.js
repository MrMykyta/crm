
// transfer.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/transfer.controller');

r.post('/', c.create);
r.post('/item/:itemId/execute', c.executeLine);

module.exports = r;
