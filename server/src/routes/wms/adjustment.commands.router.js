
// adjustment.commands.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/wms/adjustment.controller');

r.post('/', c.create);

module.exports = r;
