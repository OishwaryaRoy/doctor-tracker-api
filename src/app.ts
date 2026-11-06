import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { connectDB } from './config/db.js';
import { env, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiRouter } from './routes.js';

const ensureDb: RequestHandler = async (_req, _res, next) => {
  await connectDB();
  next();
};

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.set('query parser', 'simple');

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest)
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Doctor Tracker API', version: 'v1', docs: '/api/v1', health: '/health' });
  });

  app.get('/health', ensureDb, async (_req, res) => {
    await mongoose.connection.db?.admin().ping();
    res.set('Cache-Control', 'no-store').json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1', ensureDb, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
