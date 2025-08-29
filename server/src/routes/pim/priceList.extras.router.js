
// priceList.extras.router.js (generated)
const r=require('express').Router();
const c=require('../../controllers/pim/priceList.extras.controller');
r.put('/:id/items', c.setItems);
r.get('/:id/best-price', c.bestPrice);
module.exports = r;
