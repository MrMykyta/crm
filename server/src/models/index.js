'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(path.resolve(__dirname, '..', 'config', 'config.js'))[env];

const db = {};

// 1) Инициализация Sequelize
let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// 2) Хелпер: рекурсивно собрать все *.js модели, кроме index.js и *.test.js
function collectModelFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const e of entries) {
    // пропускаем скрытые и служебные папки
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__tests__') continue;

    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...collectModelFiles(full));
    } else if (e.isFile()) {
      const isJS = e.name.endsWith('.js');
      const isIndex = e.name === basename;
      const isTest = e.name.endsWith('.test.js') || e.name.endsWith('.spec.js');
      if (isJS && !isIndex && !isTest) files.push(full);
    }
  }
  return files;
}

// 3) Рекурсивно подключаем модели
const modelFiles = collectModelFiles(__dirname);
for (const file of modelFiles) {
  // каждой модели передаём (sequelize, DataTypes)
  const modelFactory = require(file);
  if (typeof modelFactory !== 'function') continue;

  const model = modelFactory(sequelize, Sequelize.DataTypes);
  if (!model || !model.name) {
    // на случай, если в файле не модель
    continue;
  }

  // если уже есть модель с таким именем — предупредим (коллизии имён)
  if (db[model.name]) {
    // eslint-disable-next-line no-console
    console.warn(`[models] duplicate model name detected: ${model.name} from ${file}`);
  }
  db[model.name] = model;
}

// 4) Проставляем ассоциации
Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

// 5) Экспорт
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;


