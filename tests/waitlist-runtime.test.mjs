import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Miniflare, Response } from 'miniflare';

const script = readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');

for (const status of [200, 302, 503]) {
  test(`Cloudflare runtime handles email API status ${status}`, { timeout: 30000 }, async (t) => {
    const requests = [];
    const mf = new Miniflare({
      modules: true,
      script,
      compatibilityDate: '2025-01-01',
      d1Databases: ['DB'],
      bindings: { APP_BASE_URL: 'https://app.green-go.ro' },
      outboundService: async (request) => {
        requests.push(request);
        return new Response(null, {
          status,
          headers: status === 302 ? { location: 'https://example.com/unexpected-redirect' } : {},
        });
      },
    });
    t.after(() => mf.dispose());

    const response = await mf.dispatchFetch('https://green-go.ro/api/waitlist', {
      method: 'POST',
      headers: { origin: 'https://green-go.ro', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', phone: '', consent: true }),
    });

    assert.equal(requests.length, 1, 'the request must reach the email API exactly once');
    const url = new URL(requests[0].url);
    assert.equal(url.origin, 'https://app.green-go.ro');
    assert.equal(url.pathname, '/api/email');
    assert.equal(url.searchParams.get('email'), 'test@example.com');
    assert.equal(response.status, status === 200 ? 200 : 502);
    assert.deepEqual(await response.json(), status === 200
      ? { ok: true, emailed: false }
      : { ok: false, error: 'notification' });
  });
}
