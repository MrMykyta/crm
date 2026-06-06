'use strict';

const warehouseDocumentsService = require('../../services/wms/warehouseDocumentsService');

// GET /api/wms/documents — unified warehouse documents list.
//
// Query params (all optional):
//   type        comma-separated subset of PZ,WZ,MM,RW,PW (PZK/WZK accepted but empty)
//   status      comma-separated lowercase statuses
//   search | q  ILIKE pattern on number
//   warehouseId UUID
//   dateFrom    ISO date/time (>= filter on date)
//   dateTo      ISO date/time (<= filter on date)
//   limit       1..200 (default 50). pageSize is treated as alias.
//   offset      absolute offset; OR
//   page        1-based page index
module.exports.list = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const result = await warehouseDocumentsService.list({
      companyId,
      query: req.query,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
};
