'use strict';

const service = require('../../services/oms/creditNoteService');
const generatedDocumentService = require('../../services/documents/generatedDocument.service');
const documentDeliveryService = require('../../services/documents/documentDelivery.service');

module.exports.list = async (req, res, next) => {
  try {
    res.json(await service.list({
      companyId: req.user.companyId,
      filters: req.query || {},
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.get = async (req, res, next) => {
  try {
    res.json(await service.getById({
      companyId: req.user.companyId,
      id: req.params.id,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.issueFromInvoice = async (req, res, next) => {
  try {
    res.status(201).json(await service.issue({
      companyId: req.user.companyId,
      invoiceId: req.params.invoiceId,
      orderId: req.body?.orderId || null,
      payload: req.body || {},
      userId: req.user.id,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.apply = async (req, res, next) => {
  try {
    res.json(await service.apply({
      companyId: req.user.companyId,
      creditNoteId: req.params.id,
      applications: req.body?.applications || [],
      userId: req.user.id,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.cancel = async (req, res, next) => {
  try {
    res.json(await service.cancel({
      companyId: req.user.companyId,
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.refund = async (req, res, next) => {
  try {
    res.json(await service.refund({
      companyId: req.user.companyId,
      id: req.params.id,
      amount: req.body?.amount,
      method: req.body?.method,
      reference: req.body?.reference,
      userId: req.user.id,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.generatePdf = async (req, res, next) => {
  try {
    res.status(201).json(await generatedDocumentService.generateForEntity({
      entityType: 'credit_note',
      entityId: req.params.id,
      user: req.user,
      locale: req.body?.locale || req.query?.locale || 'pl',
      templateId: req.body?.templateId || req.query?.templateId || null,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports.sendDocument = async (req, res, next) => {
  try {
    res.status(200).json(await documentDeliveryService.sendEmail({
      entityType: 'credit_note',
      entityId: req.params.id,
      user: req.user,
      payload: req.body || {},
    }));
  } catch (error) {
    next(error);
  }
};
