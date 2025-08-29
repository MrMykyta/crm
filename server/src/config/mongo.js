import mongoose from 'mongoose';

export async function initMongo() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, { autoIndex: true });
  return mongoose.connection;
}
