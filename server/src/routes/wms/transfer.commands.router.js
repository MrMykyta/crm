
// transfer.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/transfer.controller');
const acl = require('./acl');

r.post('/', acl.documentCreate, c.create);
r.post('/item/:itemId/execute', acl.documentPost, c.executeLine);

module.exports = r;
