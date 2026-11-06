import pino from 'pino';
import { env, isTest } from './env.js';

const usePrettyLogs = env.NODE_ENV === 'development';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  ...(usePrettyLogs && {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
  }),
});
