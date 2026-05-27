'use strict';

const legacyDb = require('../../models');

const db = { ...legacyDb };
const sequelize = legacyDb.sequelize;
const DataTypes = legacyDb.Sequelize.DataTypes;

if (!db.Template) {
  db.Template = require('./template')(sequelize, DataTypes);
}

if (!db.TemplateVersion) {
  db.TemplateVersion = require('./templateVersion')(sequelize, DataTypes);
}

if (!db.TemplateVersionContent) {
  db.TemplateVersionContent = require('./templateVersionContent')(sequelize, DataTypes);
}

if (!db.TemplateDraft) {
  db.TemplateDraft = require('./templateDraft')(sequelize, DataTypes);
}

for (const modelName of ['Template', 'TemplateVersion', 'TemplateVersionContent', 'TemplateDraft']) {
  const model = db[modelName];
  if (model && typeof model.associate === 'function') {
    model.associate(db);
  }
}

module.exports = db;
