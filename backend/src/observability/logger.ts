import pino from 'pino';
import { config } from '../config/config';
import { APP_NAME } from '../constants/app.constants';

/**
 * Structured JSON logger (pino). Pretty-printed in development; raw JSON lines
 * in production (stdout).
 */
export const logger = pino({
  name: APP_NAME.toLowerCase(),
  level: config.LOG_LEVEL,
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});
