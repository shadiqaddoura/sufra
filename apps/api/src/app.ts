import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createCatalog, createCatalogRouter, type CatalogReader } from './modules/catalog/index.js';
import { createRecommendationRouter, type AiRanker } from './modules/recommendations/index.js';

export interface AppOptions { catalog?: CatalogReader; ai?: AiRanker; staticDir?: string; log?: (entry: Record<string, unknown>) => void }
export function createApp(options: AppOptions = {}) {
  const app = express();
  const catalog = options.catalog ?? createCatalog();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    const start = performance.now();
    const requestPath = req.path;
    res.on('finish', () => options.log?.({ requestId: res.locals.requestId, method: req.method, path: requestPath, status: res.statusCode, durationMs: Math.round(performance.now() - start) }));
    next();
  });
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', rateLimit({
    windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.', requestId: res.locals.requestId } }),
  }));
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiAvailable: Boolean(options.ai), catalogSize: catalog.list().length }));
  app.use('/api/menu', createCatalogRouter(catalog));
  app.use('/api/recommendations', createRecommendationRouter(catalog, options.ai));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.', requestId: res.locals.requestId } }));
  if (options.staticDir && existsSync(path.join(options.staticDir, 'index.html'))) {
    app.use(express.static(options.staticDir));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(options.staticDir!, 'index.html')));
  }
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: res.locals.requestId } }));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError && 'body' in error ? 400 : 500;
    res.status(status).json({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_BODY', message: status === 500 ? 'Something went wrong.' : 'Send valid JSON within the 8 KB body limit.', requestId: res.locals.requestId } });
  };
  app.use(errorHandler);
  return app;
}
