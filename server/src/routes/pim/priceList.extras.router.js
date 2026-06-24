
// priceList.extras.router.js (generated)
const r=require('express').Router();
const authorize=require('../../middleware/authorize');
const c=require('../../controllers/pim/priceList.extras.controller');
r.put('/:id/items', authorize('price_list:update'), c.setItems);
r.get('/:id/best-price', authorize('price_list:read'), c.bestPrice);
module.exports = r;
