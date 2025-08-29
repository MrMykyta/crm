const { Router } = require('express');
const router = Router();

router.use('/inventory',   require('./inventory.commands.router'));
router.use('/receipts',    require('./receipt.commands.router'));
router.use('/pick',        require('./pick.commands.router'));
router.use('/shipments',   require('./shipment.commands.router'));
router.use('/transfers',   require('./transfer.commands.router'));
router.use('/adjustments', require('./adjustment.commands.router'));

router.use('/warehouses', require('./warehouse.router'));
router.use('/locations', require('./location.router'));
router.use('/lots', require('./lot.router'));
router.use('/serials', require('./serial.router'));
router.use('/inventory-items', require('./inventoryItem.router'));
router.use('/reservations', require('./reservation.router'));
router.use('/stock-moves', require('./stockMove.router'));
router.use('/receipts', require('./receipt.router'));
router.use('/receipt-items', require('./receiptItem.router'));
router.use('/transfers', require('./transferOrder.router'));
router.use('/transfer-items', require('./transferItem.router'));
router.use('/pick-waves', require('./pickWave.router'));
router.use('/pick-tasks', require('./pickTask.router'));
router.use('/shipments', require('./shipment.router'));
router.use('/shipment-items', require('./shipmentItem.router'));
router.use('/parcels', require('./parcel.router'));
router.use('/adjustments', require('./adjustment.router'));
router.use('/adjustment-items', require('./adjustmentItem.router'));
router.use('/cycle-counts', require('./cycleCount.router'));
router.use('/count-items', require('./countItem.router'));

module.exports = router;
