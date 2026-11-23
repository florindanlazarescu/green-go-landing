import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.js';

const origin = 'https://www.green-go.ro';
const backend = 'https://app.green-go.ro';
const signup = {
  email: 'Vecin+Test@example.com',
  phone: '+40712000000',
  consent: true,
  source: 'utm_source=vecini&zona=Greenfield',
};

function request(payload = signup) {
  return new Request(`${origin}/api/waitlist`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test('launch signup notifies the contact API without requiring D1', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => new Response(null));
  const response = await worker.fetch(request(), { APP_BASE_URL: backend }, {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, emailed: false });
  assert.equal(outbound.mock.callCount(), 1);
  const [url, options] = outbound.mock.calls[0].arguments;
  assert.equal(url.origin, backend);
  assert.equal(url.pathname, '/api/email');
  assert.equal(url.searchParams.get('subject'), 'Înscriere lansare GreenGO');
  assert.equal(url.searchParams.get('company'), 'Vizitator pagină lansare');
  assert.equal(url.searchParams.get('email'), 'vecin+test@example.com');
  assert.equal(url.searchParams.get('phone'), signup.phone);
  assert.equal(url.searchParams.get('city'), 'Greenfield');
  assert.ok(url.searchParams.get('message').includes(`/lansare/?${signup.source}`));
  assert.ok(url.searchParams.get('message').includes('Am acceptat'));
  assert.equal(options.method, 'GET');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'manual');
});

test('signup supports an omitted phone and a staging backend', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => new Response(null));
  const response = await worker.fetch(request({ ...signup, phone: '' }), {
    APP_BASE_URL: 'https://delivery-staging.green-go.ro',
  }, {});

  assert.equal(response.status, 200);
  const [url] = outbound.mock.calls[0].arguments;
  assert.equal(url.origin, 'https://delivery-staging.green-go.ro');
  assert.equal(url.searchParams.get('phone'), 'Nespecificat');
});

test('upstream HTTP errors do not confirm signup', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  const response = await worker.fetch(request(), { APP_BASE_URL: backend }, {});

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: 'notification' });
});

test('network errors and timeouts allow a later retry', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => {
    throw new DOMException('Timeout', 'TimeoutError');
  });
  const failed = await worker.fetch(request(), { APP_BASE_URL: backend }, {});
  assert.equal(failed.status, 502);
  assert.equal((await failed.json()).ok, false);

  outbound.mock.mockImplementation(async () => new Response(null));
  const retried = await worker.fetch(request(), { APP_BASE_URL: backend }, {});
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).ok, true);
});

test('invalid input is rejected before sending email', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected outbound request');
  });
  const cases = [
    [{ ...signup, email: 'invalid' }, 'email'],
    [{ ...signup, phone: '123' }, 'phone'],
    [{ ...signup, consent: false }, 'consent'],
    [null, 'bad_request'],
    [[], 'bad_request'],
  ];
  for (const [payload, error] of cases) {
    const response = await worker.fetch(request(payload), { APP_BASE_URL: backend }, {});
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error });
  }
  const malformed = new Request(`${origin}/api/waitlist`, { method: 'POST', body: '{' });
  assert.equal((await worker.fetch(malformed, { APP_BASE_URL: backend }, {})).status, 400);
  assert.equal(outbound.mock.callCount(), 0);
});

test('honeypots and requests from another origin do not send email', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected outbound request');
  });
  const bot = await worker.fetch(request({ ...signup, website: 'spam.example' }), {
    APP_BASE_URL: backend,
  }, {});
  assert.equal(bot.status, 200);

  const foreign = request();
  foreign.headers.set('origin', 'https://other.example');
  assert.equal((await worker.fetch(foreign, { APP_BASE_URL: backend }, {})).status, 403);
  assert.equal(outbound.mock.callCount(), 0);
});

test('missing backend configuration does not report success', async () => {
  const response = await worker.fetch(request(), {}, {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'unavailable' });
});

function database(inserted = true) {
  const records = [];
  return {
    records,
    prepare(sql) {
      return {
        bind(...values) {
          records.push(values);
          return this;
        },
        async run() {
          return { meta: { changes: sql.startsWith('INSERT') && inserted ? 1 : 0 } };
        },
      };
    },
  };
}

test('optional D1 storage and subscriber confirmation still work', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => new Response(null));
  const db = database();
  const background = [];
  const response = await worker.fetch(request(), {
    APP_BASE_URL: backend,
    DB: db,
    RESEND_API_KEY: 'fake-test-key',
    MAIL_FROM: 'GreenGO <test@example.com>',
  }, { waitUntil(task) { background.push(task); } });
  await Promise.all(background);

  assert.equal(response.status, 200);
  assert.equal(db.records.length, 1);
  assert.equal(db.records[0][0], 'vecin+test@example.com');
  assert.equal(db.records[0][1], signup.phone);
  assert.equal(db.records[0][3], signup.source);
  assert.equal(background.length, 1);
  assert.equal(outbound.mock.callCount(), 2);
  const [url, options] = outbound.mock.calls[1].arguments;
  assert.equal(url, 'https://api.resend.com/emails');
  assert.deepEqual(JSON.parse(options.body).to, ['vecin+test@example.com']);
});

test('an existing D1 subscriber can still notify the team on retry', async (t) => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => new Response(null));
  const response = await worker.fetch(request(), { APP_BASE_URL: backend, DB: database(false) }, {});

  assert.equal(response.status, 200);
  assert.equal(outbound.mock.callCount(), 1);
});

test('optional database failures do not undo an accepted notification', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null));
  const errorLog = t.mock.method(console, 'error', () => {});
  const response = await worker.fetch(request(), {
    APP_BASE_URL: backend,
    DB: { prepare() { throw new Error('Database unavailable'); } },
  }, {});

  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(errorLog.mock.callCount(), 1);
});

test('static pages still use the environment-specific app URL', async () => {
  const response = await worker.fetch(new Request(`${origin}/lansare/`), {
    APP_BASE_URL: 'https://delivery-staging.green-go.ro',
    ASSETS: { async fetch() {
      return new Response('<a href="https://app.green-go.ro">GreenGO</a>', {
        headers: { 'content-type': 'text/html' },
      });
    } },
  }, {});

  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('https://delivery-staging.green-go.ro'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
