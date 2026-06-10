
// pick.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/pick.controller');
const acl = require('./acl');

r.post('/wave', acl.pickingManage, c.createWave);
r.post('/task/:id/complete', acl.pickingManage, c.completeTask);

module.exports = r;
