'use strict';

// Centralized, environment-aware dotenv loader (required first by index.js and config.js).
//
// File selection by NODE_ENV:
//   - production            → .env
//   - development / test /…  → .env.dev → .env.development → .env  (first match wins per-variable)
//
// dotenv does NOT override variables that are already set, so values injected by the
// runtime (docker-compose env_file / environment, shell exports, CI) always take
// precedence over what is written in the files. Loading several files only fills gaps.
//
// Paths are resolved against process.cwd() (the /server directory for npm scripts and
// sequelize-cli, and /app for the dev container that mounts ./server).

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const nodeEnv = process.env.NODE_ENV || 'development';

const candidates = nodeEnv === 'production'
  ? ['.env']
  : ['.env.dev', '.env.development', '.env'];

const cwd = process.cwd();
for (const file of candidates) {
  const fullPath = path.resolve(cwd, file);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
}

module.exports = {};
