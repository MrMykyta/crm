'use strict';

const path = require('path');
const sharedDocumentService = require('../../services/documents/sharedDocument.service');

module.exports.create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await sharedDocumentService.createShare({
        entityType: req.body?.entityType,
        entityId: req.body?.entityId,
        expiresAt: req.body?.expiresAt,
        locale: req.body?.locale || req.query?.locale || 'pl',
        templateId: req.body?.templateId || null,
        user: req.user,
      }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.list = async (req, res, next) => {
  try {
    res.json({
      data: await sharedDocumentService.listShares({
        entityType: req.query?.entityType,
        entityId: req.query?.entityId,
        user: req.user,
      }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.revoke = async (req, res, next) => {
  try {
    res.json({
      data: await sharedDocumentService.revokeShare({
        id: req.params.id,
        user: req.user,
      }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.publicView = async (req, res, next) => {
  try {
    res.json({
      data: await sharedDocumentService.getPublicDocument({
        token: req.params.token,
        req,
      }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.publicDownload = async (req, res, next) => {
  try {
    const { file, absPath } = await sharedDocumentService.getPublicDownload({
      token: req.params.token,
      req,
    });
    res.setHeader('Content-Type', file.mime || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(file.filename || 'document.pdf'))}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(absPath);
  } catch (error) {
    next(error);
  }
};
