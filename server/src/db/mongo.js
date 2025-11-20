// src/db/mongo.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose;

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/sunset';

  mongoose.set('strictQuery', false);

  await mongoose.connect(uri, { maxPoolSize: 10 });

  isConnected = true;
  console.log('[Mongo] Connected to', uri);
  return mongoose;
}

module.exports = { connectMongo, mongoose };