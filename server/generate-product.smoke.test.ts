import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * End-to-end happy-path smoke test for the simplified workflow:
 *   create product -> POST /api/generate/product -> KDP PDF artifact.
 *
 * AI calls are stubbed by replacing global fetch: the server's OpenRouter text
 * and image calls return canned responses, so no live API keys are required.
 * The test's own HTTP requests use a saved reference to the real fetch.
 */

// 1x1 transparent PNG.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const STORY_TEXT = `Page 1:
The little fox trotted into the golden forest at sunrise.
Visual Note: pine forest, warm dawn light, fox walking, soft mist

Page 2:
She found a shiny red apple beneath an old oak tree.
Visual Note: old oak, red apple, fox looking up, dappled sunlight

Page 3:
A friendly rabbit waved and they shared the apple together.
Visual Note: rabbit and fox sharing apple, meadow, flowers, bright day`;

test('create product -> generate book -> PDF artifact', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foliopress-smoke-'));
  process.env.WORKSPACE_DATA_DIR = dataDir;
  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.GEMINI_API_KEY;

  const realFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (Array.isArray(body.modalities) && body.modalities.includes('image')) {
      return new Response(
        JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          choices: [
            {
              message: {
                content: [{ type: 'image_url', image_url: { url: PNG_DATA_URL } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        model: 'openai/gpt-4o-mini',
        choices: [{ message: { content: STORY_TEXT } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  const { createApiApp } = await import('../server/app.js');
  const app = createApiApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  try {
    const createRes = await realFetch(`${base}/api/library/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Smoke Test Fox',
        subtitle: 'A sharing story',
        category: 'childrens-book',
        status: 'draft',
        trimSize: '8.5x8.5',
        pageCount: 24,
        includeBleed: true,
        seriesId: null,
        isbn: '',
        manuscriptNotes: 'A little fox learns to share an apple with a rabbit.',
      }),
    });
    if (createRes.status !== 201) {
      assert.fail(`create product failed: ${createRes.status} ${await createRes.text()}`);
    }
    const created = (await createRes.json()) as { product: { id: string } };
    assert.ok(created.product.id, 'product id returned');

    const genRes = await realFetch(`${base}/api/generate/product`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: created.product.id }),
    });
    if (genRes.status !== 201) {
      assert.fail(`generate product failed: ${genRes.status} ${await genRes.text()}`);
    }
    const generated = (await genRes.json()) as {
      artifact: { format: string; pageCount: number; fileName: string };
      product: { id: string; promptPack?: { interiorPrompts: unknown[] } };
    };

    assert.equal(generated.artifact.format, 'pdf');
    assert.ok(generated.artifact.pageCount >= 1, 'PDF has at least one page');
    assert.ok(generated.product.id === created.product.id);
  } finally {
    globalThis.fetch = realFetch;
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
