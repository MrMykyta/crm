
// channel.extras.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/pim/channel.extras.controller');
r.put('/:id/listings', c.setListings);
module.exports = r;
