import http from 'http';
import { createApp } from './app';
import { config } from './config/config';
import { APP_NAME, API_DOCS_PATH } from './constants/app.constants';
import { initSentry } from './observability/sentry';
import { logger } from './observability/logger';
import { createYjsWebSocketServer } from './sockets/yjs-sync';
import { docs } from 'y-websocket/bin/utils';
import { emailQueue } from './services/email/email-queue';
import { replayLogService } from './services/replay-log.service';
import { roomPersistenceService } from './services/room-persistence.service';

/**
 * Process entrypoint: Sentry, HTTP server, WebSocket sync endpoint,
 * graceful shutdown. All wiring lives here; behavior lives in app/sockets.
 */
initSentry();

const app = createApp();
const server = http.createServer(app);
const wss = createYjsWebSocketServer(server);

server.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    `${APP_NAME} server ready at http://localhost:${config.PORT} (docs at ${API_DOCS_PATH})`,
  );
});

/** Graceful shutdown: stop accepting work, close live connections, flush mail + logs. */
function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  for (const client of wss.clients) client.close(1001, 'Server shutting down');
  server.close(() => {
    void Promise.all([
      emailQueue.flush(config.EMAIL_QUEUE_FLUSH_TIMEOUT_MS),
      roomPersistenceService.flushAll(docs),
      replayLogService.flush(),
    ])
      .then(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Shutdown flush failed');
        process.exit(1);
      });
  });
  // Failsafe: force-exit if connections refuse to drain.
  setTimeout(
    () => process.exit(0),
    Math.max(5_000, config.EMAIL_QUEUE_FLUSH_TIMEOUT_MS + 2_000),
  ).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
