// src/db/mongo.js
const mongoose = require('mongoose');

let isConnected = false;

function buildMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;

  const host = process.env.MONGO_HOST || 'mongo';
  const port = process.env.MONGO_PORT || '27017';
  const db = process.env.MONGO_DB || 'app';
  const user = process.env.MONGO_USER || '';
  const password = process.env.MONGO_PASSWORD || '';
  const authSource = process.env.MONGO_AUTH_SOURCE || 'admin';

  if (user && password) {
    return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(
      password
    )}@${host}:${port}/${db}?authSource=${authSource}`;
  }

  return `mongodb://${host}:${port}/${db}`;
}

async function connectMongo() {
  if (isConnected) return mongoose;

  const uri = buildMongoUri();

  mongoose.set('strictQuery', false);

  await mongoose.connect(uri, { maxPoolSize: 10 });

  isConnected = true;
  console.log('[Mongo] Connected');
  return mongoose;
}

module.exports = { connectMongo, mongoose };
