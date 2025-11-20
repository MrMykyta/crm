const router = require("express").Router();
const notificationController = require("../../controllers/system/Notification.controller");

// GET /api/notifications?onlyUnread=1&limit=20&beforeId=123
router.get("/", notificationController.listMy);

// POST /api/notifications/:id/read
router.post("/:id/read", notificationController.markOneRead);

// POST /api/notifications/read-all
router.post("/read-all/all", notificationController.markAllRead);

// POST /api/notifications (опционально; для системного использования)
router.post("/", notificationController.createForUser);

module.exports = router;
