import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** backend/ — parent of e2e/ */
export const BACKEND_ROOT = resolve(__dirname, '../..');

export type E2eServer = {
  baseUrl: string;
  wsBaseUrl: string;
  port: number;
  dataDir: string;
  stop: () => Promise<void>;
};

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Could not allocate an ephemeral port'));
        return;
      }
      const { port } = addr;
      server.close((err) => (err ? reject(err) : resolvePort(port)));
    });
  });
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) return;
      lastError = new Error(`health status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Backend did not become healthy at ${baseUrl}: ${String(lastError)}`);
}

function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  child.kill('SIGTERM');
}

/**
 * Spawns `backend/src/index.ts` on an ephemeral port with an isolated DATA_DIR.
 * Env overrides beat dotenv so local SMTP/LLM secrets cannot make e2e non-deterministic.
 */
export async function startE2eServer(): Promise<E2eServer> {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'gravity-backend-e2e-'));
  const tsxCli = join(BACKEND_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsBaseUrl = `ws://127.0.0.1:${port}/ws`;

  const child = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR: dataDir,
      LOG_LEVEL: 'error',
      CORS_ORIGIN: '*',
      AUTH_MODE: 'guest',
      LLM_API_KEY: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      INVITE_FROM_EMAIL: '',
      SENTRY_DSN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const logs: string[] = [];
  const onChunk = (buf: Buffer) => {
    const text = buf.toString('utf8');
    logs.push(text);
    if (logs.join('').length > 20_000) logs.splice(0, logs.length - 1);
  };
  child.stdout?.on('data', onChunk);
  child.stderr?.on('data', onChunk);

  let exitedEarly: Error | null = null;
  child.once('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      exitedEarly = new Error(
        `Backend exited early (code=${code}, signal=${signal})\n${logs.join('')}`,
      );
    }
  });

  try {
    await waitForHealth(baseUrl, 45_000);
    if (exitedEarly) throw exitedEarly;
  } catch (err) {
    killProcessTree(child);
    rmSync(dataDir, { recursive: true, force: true });
    const detail = logs.length ? `\n--- server log ---\n${logs.join('')}` : '';
    throw new Error(`${String(err)}${detail}`);
  }

  return {
    baseUrl,
    wsBaseUrl,
    port,
    dataDir,
    stop: async () => {
      killProcessTree(child);
      await new Promise<void>((resolveStop) => {
        const timer = setTimeout(resolveStop, 3_000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolveStop();
        });
      });
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
