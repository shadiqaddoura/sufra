import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createApp } from '../src/app.js';

test('health and menu are served with security and request tracing headers', async () => {
  const app = createApp();
  const health = await supertest(app).get('/api/health').expect(200);
  assert.equal(health.body.aiAvailable, false);
  assert.equal(health.body.catalogSize, 14);
  assert.ok(health.headers['x-request-id']);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-powered-by'], undefined);
  const menu = await supertest(app).get('/api/menu').expect(200);
  assert.equal(menu.body.dishes.length, 14);
  assert.equal(menu.body.currency, 'JOD');
});

test('POST recommendations validates input and returns an enforced filtered result', async () => {
  const response = await supertest(createApp()).post('/api/recommendations').send({ maxPriceFils: 6500, diet: 'vegan', excludeAllergens: ['sesame'], flavors: ['spicy', 'smoky'] }).expect(200);
  assert.equal(response.body.recommendations[0].dish.id, 'chili-lentil');
  assert.equal(response.body.meta.requestId, response.headers['x-request-id']);
  assert.ok(response.body.recommendations.every((r: { dish: { priceFils: number; vegan: boolean; allergens: string[] } }) => r.dish.priceFils <= 6500 && r.dish.vegan && !r.dish.allergens.includes('sesame')));
});

test('invalid, oversized and malformed input gets a consistent JSON error', async () => {
  const app = createApp();
  for (const body of [{}, { maxPriceFils: -1 }, { maxPriceFils: 2.5 }, { maxPriceFils: '6500' }, { maxPriceFils: 51000 }, { maxPriceFils: 5000, diet: 'paleo' }, { maxPriceFils: 5000, excludeAllergens: ['unknown'] }, { maxPriceFils: 5000, admin: true }, { maxPriceFils: 5000, limit: 99 }, { maxPriceFils: 5000, mood: 'x'.repeat(301) }, null]) {
    const res = await supertest(app).post('/api/recommendations').set('Content-Type', 'application/json').send(JSON.stringify(body)).expect(400);
    assert.ok(res.body.error.requestId);
  }
  const malformed = await supertest(app).post('/api/recommendations').set('Content-Type', 'application/json').send('{oops').expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_BODY');
  await supertest(app).post('/api/recommendations').send({ maxPriceFils: 5000, mood: 'a'.repeat(9000) }).expect(413);
  const missing = await supertest(app).get('/api/missing').expect(404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
});

test('rate limit returns a JSON 429 after the request budget is consumed', async () => {
  const app = createApp();
  for (let index = 0; index < 60; index++) await supertest(app).get('/api/health').expect(200);
  const limited = await supertest(app).get('/api/health').expect(429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(limited.headers['retry-after']);
});

test('request logs exclude personal craving text and credentials', async () => {
  const entries: Record<string, unknown>[] = [];
  await supertest(createApp({ log: entry => entries.push(entry) })).post('/api/recommendations').send({ maxPriceFils: 5000, mood: 'private craving' }).expect(200);
  assert.equal(entries.length, 1);
  assert.ok(!JSON.stringify(entries).includes('private craving'));
  assert.equal(entries[0]?.status, 200);
  assert.equal(entries[0]?.path, '/api/recommendations');
});
