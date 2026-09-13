import type { TestProject } from 'vitest/node';
import { startE2eServer, type E2eServer } from './helpers/server.js';

let server: E2eServer | undefined;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  server = await startE2eServer();
  project.provide('e2eBaseUrl', server.baseUrl);
  project.provide('e2eWsBaseUrl', server.wsBaseUrl);

  return async () => {
    await server?.stop();
    server = undefined;
  };
}
