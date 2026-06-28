const service = require('../../services/crm/pipelineService');

function sendError(res, error) {
  res.status(error.status || 400).send({ error: error.message });
}

module.exports.list = async (req, res) => {
  try {
    res.json(await service.list(req.user.companyId));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.create = async (req, res) => {
  try {
    res.status(201).json(await service.createPipeline(req.user.companyId, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.update = async (req, res) => {
  try {
    res.json(await service.updatePipeline(req.user.companyId, req.params.id, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.remove = async (req, res) => {
  try {
    res.json(await service.deletePipeline(req.user.companyId, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.reorder = async (req, res) => {
  try {
    const orderedPipelineIds = req.body?.orderedPipelineIds || req.body?.pipelineIds || req.body;
    res.json(await service.reorderPipelines(req.user.companyId, orderedPipelineIds));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.addStage = async (req, res) => {
  try {
    res.status(201).json(await service.addStage(req.user.companyId, req.params.pipelineId, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.updateStage = async (req, res) => {
  try {
    res.json(await service.updateStage(
      req.user.companyId,
      req.params.pipelineId,
      req.params.stageId,
      req.body
    ));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.deleteStage = async (req, res) => {
  try {
    res.json(await service.deleteStage(
      req.user.companyId,
      req.params.pipelineId,
      req.params.stageId,
      { replacementStageId: req.body?.replacementStageId || req.query?.replacementStageId }
    ));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports.reorderStages = async (req, res) => {
  try {
    const orderedStageIds = req.body?.orderedStageIds || req.body?.stageIds || req.body;
    res.json(await service.reorderStages(req.user.companyId, req.params.pipelineId, orderedStageIds));
  } catch (error) {
    sendError(res, error);
  }
};
