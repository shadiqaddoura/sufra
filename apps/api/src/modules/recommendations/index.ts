import { Router } from 'express';
import { recommendationRequestSchema } from '@sufra/contracts';
import type { CatalogReader } from '../catalog/index.js';
import type { AiRanker } from './ai-ranker.js';
import { createRecommendationService } from './service.js';

export { createOpenAiRanker, type AiRanker } from './ai-ranker.js';
export function createRecommendationRouter(catalog: CatalogReader, ai?: AiRanker): Router {
  const router = Router();
  const service = createRecommendationService(catalog, ai);
  router.post('/', async (req, res) => {
    const parsed = recommendationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'body';
        (fields[field] ??= []).push(issue.message);
      }
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the recommendation preferences.', fields, requestId: res.locals.requestId } });
      return;
    }
    res.json(await service.recommend(parsed.data, res.locals.requestId));
  });
  return router;
}
