'use strict';

const timelineService = require('../../services/system/timelineService');

module.exports.list = async (req, res) => {
  try {
    const data = await timelineService.list(req.user.companyId, req.query);
    res.status(200).send({ data });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[TimelineController.list]', e);
    res.status(status).send({ error: e.message });
  }
};
