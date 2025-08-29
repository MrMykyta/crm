
// pick.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/pick.controller');

r.post('/wave', c.createWave);
r.post('/task/:id/complete', c.completeTask);

module.exports = r;
