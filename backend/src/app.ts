import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/config';
import { API_DOCS_PATH, API_PREFIX, RATE_LIMIT } from './constants/app.constants';
import { openApiSpec } from './docs/swagger';
import { authMiddleware } from './middleware/auth.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { logger } from './observability/logger';
import { apiRouter } from './routes';
import { ApiError } from './types/api-error';

/**
 * Express application factory. Deliberately does not call .listen(),
 * so integration tests can exercise the full middleware chain in-process.
 *
 * Request pipeline: hardening -> request-id -> logging -> auth ->
 * routes (validation per-route) -> 404 -> central error handler.
 */
export function createApp(): Express {
  const app = express();

  // Docker/nginx sets X-Forwarded-For; required for express-rate-limit.
  app.set('trust proxy', 1);

  // cross-origin: Vite DEV (:5173) loads media from the API (:4000) in <img>/<audio>.
  // Helmet's default CORP "same-origin" blocks those embeds (net::ERR_BLOCKED_BY_RESPONSE).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors({ origin: config.corsOrigins }));
  // Skip compression on Orbit SSE so tokens flush live through the proxy.
  app.use(
    compression({
      filter: (req, res) => {
        if (req.path.includes('/orbit/chat/stream')) return false;
        return compression.filter(req, res);
      },
    }),
  );
  // Media uploads send base64 data URLs; keep the limit modest.
  app.use(express.json({ limit: '3mb' }));

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` },
    }),
  );
  app.use(authMiddleware);

  app.use(API_PREFIX, rateLimit({ ...RATE_LIMIT, standardHeaders: true, legacyHeaders: false }), apiRouter);
  app.get(`${API_DOCS_PATH}.json`, (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(API_DOCS_PATH, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Unknown API routes return the API error envelope (registered after real routes).
  app.use(API_PREFIX, (req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', `No such endpoint: ${req.method} ${req.path}`));
  });

  app.use(errorMiddleware);
  return app;
}
