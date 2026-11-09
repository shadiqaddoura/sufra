import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationRequestSchema, type RecommendationRequest } from '@sufra/contracts';
import { createCatalog } from '../src/modules/catalog/index.js';
import { rankContentBased } from '../src/modules/recommendations/content-ranker.js';
import { createRecommendationService } from '../src/modules/recommendations/service.js';

const catalog = createCatalog();
const service = createRecommendationService(catalog);
const request = (overrides: Partial<RecommendationRequest> = {}) => recommendationRequestSchema.parse({ maxPriceFils: 6500, diet: 'vegan', excludeAllergens: ['sesame'], limit: 6, ...overrides });
const ids = (result: Awaited<ReturnType<typeof service.recommend>>) => result.recommendations.map(r => r.dish.id);

test('saving a dish changes ranking without changing eligibility or requiring exact dish matches', async () => {
  const cold = await service.recommend(request(), 'cold');
  const personalized = await service.recommend(request({ likedDishIds: ['harissa-chicken'] }), 'personalized');
  assert.equal(cold.recommendations[0]?.dish.id, 'batata-harra');
  assert.equal(personalized.recommendations[0]?.dish.id, 'chili-lentil');
  assert.deepEqual(new Set(ids(cold)), new Set(ids(personalized)));
  assert.equal(personalized.meta.ranking.profileSize, 1);
  assert.equal(personalized.meta.ranking.strategy, 'personalized');
  assert.ok(!ids(personalized).includes('harissa-chicken'));
  assert.ok(personalized.recommendations[0]?.reasons.some(reason => reason.includes('your saved Harissa chicken bowl')));
});

test('changing and removing favorites updates the taste profile, not a global user state', async () => {
  const a = await service.recommend(request({ likedDishIds: ['garden-quinoa'] }), 'a');
  const b = await service.recommend(request({ likedDishIds: ['harissa-chicken'] }), 'b');
  const removed = await service.recommend(request(), 'removed');
  assert.equal(a.recommendations[0]?.dish.id, 'garden-quinoa');
  assert.equal(b.recommendations[0]?.dish.id, 'chili-lentil');
  assert.equal(removed.recommendations[0]?.dish.id, 'batata-harra');
  assert.equal(removed.meta.ranking.profileSize, 0);
});

test('scores expose normalized active weights and additive points, not confidence', async () => {
  const response = await service.recommend(request({ likedDishIds: ['harissa-chicken'], flavors: ['smoky'], mood: 'lentils please' }), 'score');
  assert.deepEqual(response.meta.ranking.recognizedCravingTerms, ['lentil']);
  for (const recommendation of response.recommendations) {
    assert.deepEqual(recommendation.scoreBreakdown.map(c => c.weight), [0.5, 0.2, 0.3]);
    assert.equal(recommendation.score, Math.round(recommendation.scoreBreakdown.reduce((sum, c) => sum + c.points, 0) * 10) / 10);
    assert.ok(recommendation.score >= 0 && recommendation.score <= 100);
    for (const component of recommendation.scoreBreakdown) assert.ok(component.similarity >= 0 && component.similarity <= 1);
  }
  const noCraving = await service.recommend(request({ likedDishIds: ['harissa-chicken'], flavors: ['smoky'] }), 'weights');
  assert.deepEqual(noCraving.recommendations[0]?.scoreBreakdown.map(c => c.weight), [0.625, 0.375]);
});

test('cold start and unknown craving words honestly fall back to price, then stable ID', async () => {
  const response = await service.recommend(request({ mood: 'please something xyzzy' }), 'cold');
  assert.equal(response.meta.ranking.strategy, 'value');
  assert.ok(response.recommendations.every(r => r.score === 0 && r.scoreBreakdown.length === 0));
  assert.deepEqual(ids(response), ['batata-harra', 'garden-quinoa', 'chili-lentil']);
  assert.ok(response.recommendations[0]?.reasons.includes('No taste signals yet; baseline uses price, then dish ID'));
});

test('duplicate favorites, duplicate flavors and unknown saved IDs cannot amplify a score', async () => {
  const baseline = await service.recommend(request({ likedDishIds: ['harissa-chicken'], flavors: ['smoky'] }), 'a');
  const duplicated = await service.recommend(request({ likedDishIds: ['harissa-chicken', 'harissa-chicken', 'deleted-id'], flavors: ['smoky', 'smoky'] }), 'b');
  assert.deepEqual(duplicated.recommendations, baseline.recommendations);
  assert.deepEqual(duplicated.meta.ranking, baseline.meta.ranking);
});

test('unrecognized favorites do not turn a cold start into fake personalization', async () => {
  const response = await service.recommend(request({ likedDishIds: ['stale-id'] }), 'unknown');
  assert.equal(response.meta.ranking.profileSize, 0);
  assert.equal(response.meta.ranking.strategy, 'value');
});

test('catalog input order and tighter candidate set do not change a dish score', () => {
  const dishes = catalog.list();
  const preferences = request({ likedDishIds: ['harissa-chicken', 'garden-quinoa'], flavors: ['fresh'], mood: 'lemon' });
  const all = rankContentBased(dishes, preferences, dishes);
  const reversed = rankContentBased([...dishes].reverse(), preferences, [...dishes].reverse());
  assert.deepEqual(all, reversed);
  const subset = rankContentBased(dishes.filter(d => d.vegan), preferences, dishes);
  for (const recommendation of subset.recommendations) {
    assert.deepEqual(recommendation, all.recommendations.find(r => r.dish.id === recommendation.dish.id));
  }
});

test('fewer signals rescale weights and identical saved dish has full self-similarity', async () => {
  const response = await service.recommend(request({ likedDishIds: ['garden-quinoa'] }), 'self');
  assert.equal(response.recommendations[0]?.score, 100);
  assert.deepEqual(response.recommendations[0]?.scoreBreakdown.map(c => [c.signal, c.weight]), [['favorites', 1]]);
});

test('even a strong saved profile never relaxes budget, diet, allergen or category limits', async () => {
  for (const likedDishIds of [['harissa-chicken'], ['hummus-pita'], ['lemon-salmon']]) {
    const response = await service.recommend(request({ likedDishIds, maxPriceFils: 4000, category: 'sides' }), 'constraints');
    assert.deepEqual(ids(response), ['batata-harra']);
  }
  const none = await service.recommend(request({ likedDishIds: ['harissa-chicken'], maxPriceFils: 0 }), 'none');
  assert.deepEqual(none.recommendations, []);
});

test('AI receives baseline personalization and fallback preserves its full explanation', async () => {
  const preferences = request({ useAi: true, likedDishIds: ['harissa-chicken'] });
  const fallback = await service.recommend(preferences, 'baseline');
  let called = false;
  const result = await createRecommendationService(catalog, { rank: async (_dishes, _request, baseline) => {
    called = true;
    assert.deepEqual(baseline, fallback.recommendations);
    throw new Error('provider offline');
  } }).recommend(preferences, 'fail');
  assert.equal(called, true);
  assert.deepEqual(result.recommendations, fallback.recommendations);
  assert.deepEqual(result.meta.ranking, fallback.meta.ranking);
});

test('the saved-dish payload is bounded and rejects malformed IDs', () => {
  for (const likedDishIds of [[''], ['a'.repeat(81)], [4], Array(51).fill('dish'), 'dish']) {
    assert.equal(recommendationRequestSchema.safeParse({ maxPriceFils: 6500, likedDishIds }).success, false);
  }
});
