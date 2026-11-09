import { performance } from 'node:perf_hooks';
import type { RecommendationRequest, RecommendationResponse, FallbackReason } from '@sufra/contracts';
import type { CatalogReader } from '../catalog/index.js';
import type { AiRanker } from './ai-ranker.js';
import { isEligible, violations } from './domain.js';
import { rankContentBased } from './content-ranker.js';

export function createRecommendationService(catalog: CatalogReader, ai?: AiRanker) {
  return {
    async recommend(request: RecommendationRequest, requestId: string): Promise<RecommendationResponse> {
      const started = performance.now();
      const dishes = catalog.list();
      const excluded = { budget: 0, diet: 0, allergens: 0, category: 0 };
      for (const dish of dishes) {
        const failed = violations(dish, request);
        for (const rule of Object.keys(excluded) as (keyof typeof excluded)[]) if (failed[rule]) excluded[rule]++;
      }
      const eligible = dishes.filter(dish => isEligible(dish, request));
      const baseline = rankContentBased(eligible, request, dishes);
      let recommendations = baseline.recommendations;
      let mode: 'deterministic' | 'ai' = 'deterministic';
      let fallbackReason: FallbackReason | undefined = !eligible.length ? 'no-candidates' : !request.useAi ? 'not-requested' : !ai ? 'not-configured' : undefined;
      if (request.useAi && ai && eligible.length) {
        try {
          const picks = await ai.rank(eligible, request, baseline.recommendations);
          const byId = new Map(recommendations.map(rec => [rec.dish.id, rec]));
          const ids = new Set(picks.map(pick => pick.dishId));
          // The provider controls ordering and a separate explanation only. All dish facts come from the catalog.
          if (picks.length !== eligible.length || ids.size !== eligible.length || picks.some(pick =>
            !byId.has(pick.dishId) || typeof pick.explanation !== 'string' || !pick.explanation.trim() || pick.explanation.length > 240)) {
            fallbackReason = 'invalid-output';
          } else {
            recommendations = picks.map(pick => ({ ...byId.get(pick.dishId)!, aiExplanation: pick.explanation }));
            mode = 'ai';
          }
        } catch {
          // Never expose provider bodies or credentials to the client/logs; no retry can duplicate costs.
          fallbackReason = 'provider-error';
        }
      }
      // Defense in depth: even a faulty adapter cannot widen the eligible set.
      recommendations = recommendations.filter(rec => isEligible(rec.dish, request)).slice(0, request.limit);
      return { recommendations, meta: {
        mode, ranking: baseline.ranking, ...(fallbackReason ? { fallbackReason } : {}), totalDishes: dishes.length,
        eligibleDishes: eligible.length, excluded, requestId, durationMs: Math.round(performance.now() - started),
      } };
    },
  };
}
