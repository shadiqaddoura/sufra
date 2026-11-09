import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationRequestSchema } from '@sufra/contracts';
import { createCatalog } from '../src/modules/catalog/index.js';
import { createOpenAiRanker } from '../src/modules/recommendations/ai-ranker.js';

const config = { apiKey: 'fake-test-key', model: 'fake-test-model', timeoutMs: 100 };
const dishes = createCatalog().list().slice(0, 2);
const preferences = recommendationRequestSchema.parse({ maxPriceFils: 10000, mood: 'smoky' });
const picks = dishes.map(dish => ({ dishId: dish.id, explanation: 'A smoky taste.' }));

test('adapter sends schema-bound eligible IDs and reads the Responses API output', async () => {
  const fakeFetch: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.store, false);
    assert.equal(body.model, 'fake-test-model');
    assert.equal(body.text.format.strict, true);
    assert.deepEqual(body.text.format.schema.properties.picks.items.properties.dishId.enum, dishes.map(d => d.id));
    assert.ok(options?.signal);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ picks }) }] }] });
  };
  assert.deepEqual(await createOpenAiRanker(config, fakeFetch).rank(dishes, preferences), picks);
});

test('adapter handles provider errors, refusal, invalid JSON and incomplete output', async () => {
  const outputs = [
    new Response('private error', { status: 429 }),
    Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }),
    Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'bad json' }] }] }),
    Response.json({ status: 'incomplete', output: [] }),
  ];
  for (const output of outputs) {
    await assert.rejects(createOpenAiRanker(config, async () => output).rank(dishes, preferences));
  }
});

test('request deadline aborts a slow provider with no retry', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test provider ignored abort')), 500);
      options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Timed out')); }, { once: true });
    });
  };
  await assert.rejects(createOpenAiRanker(config, fakeFetch).rank(dishes, preferences), /Timed out/);
  assert.equal(calls, 1);
});
