require('./loadEnv');

// Базовые настройки Sequelize, общие для всех окружений.
const base = {
  dialect: 'postgres',
  logging: false,
};

// Конфигурация БД для sequelize-cli и runtime:
// значения берутся из переменных окружения.
module.exports = {
  development: {
    ...base,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  production: {
    ...base,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};
