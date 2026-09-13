import { defineConfig } from 'vitest/config';

/**
 * Unit + integration tests. Force a clean invite-from so a local `.env`
 * typo (e.g. bare `no-reply`) cannot process.exit during config import.
 * dotenv will not override keys already set here.
 */
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      INVITE_FROM_EMAIL: '',
    },
  },
});
