import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createOpenAiRanker } from './modules/recommendations/index.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
const ai = process.env.AI_ENABLED === 'true' && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
  ? createOpenAiRanker({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL, timeoutMs: Math.min(15_000, Math.max(100, Number(process.env.AI_TIMEOUT_MS) || 5000)) })
  : undefined;
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '127.0.0.1';
const app = createApp({ ai, staticDir: process.env.NODE_ENV === 'production' ? fileURLToPath(new URL('../../web/dist', import.meta.url)) : undefined, log: entry => console.log(JSON.stringify(entry)) });
const server = app.listen(port, host, () => console.log(`Sufra API: http://${host}:${port} | AI ${ai ? 'available (opt-in per request)' : 'off; deterministic ranking ready'}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
});
