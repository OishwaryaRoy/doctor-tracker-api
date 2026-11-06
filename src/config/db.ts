import mongoose from 'mongoose';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

type MongooseCache = { promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as typeof globalThis & { __mongoose?: MongooseCache };
const cache: MongooseCache = (globalForMongoose.__mongoose ??= { promise: null });

export function connectDB(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);

  cache.promise ??= mongoose
    .connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
      autoIndex: !isProduction,
    })
    .then((connection) => {
      logger.info('MongoDB connected');
      return connection;
    })
    .catch((error: unknown) => {
      cache.promise = null;
      throw error;
    });

  return cache.promise;
}

export async function disconnectDB(): Promise<void> {
  cache.promise = null;
  await mongoose.disconnect();
}
