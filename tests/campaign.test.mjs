import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Miniflare, Response } from 'miniflare';

const script = readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
const origin = 'https://www.green-go.ro';
const key = 'local-test-key';

async function campaign(t) {
  const notifications = [];
  const mf = new Miniflare({
    modules: true, script, compatibilityDate: '2025-01-01',
    d1Databases: ['DB'],
    bindings: { APP_BASE_URL: 'https://app.green-go.ro', EXPORT_KEY: key },
    outboundService: async (request) => {
      notifications.push(request);
      return new Response(null);
    },
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  return {
    mf, db, notifications,
    signup(data = {}) {
      return mf.dispatchFetch(`${origin}/api/waitlist`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'vecin@example.com', phone: '', consent: true, ...data }),
      });
    },
    get(path, authorization = key) {
      return mf.dispatchFetch(origin + path, {
        headers: authorization === null ? {} : { authorization: 'Bearer ' + authorization },
      });
    },
  };
}

test('campaign stores a single normalized email across retries', async (t) => {
  const c = await campaign(t);
  const first = await c.signup({ email: ' Vecin@Example.com ', phone: '+40712000000', source: 'utm_source=Facebook' });
  const retry = await c.signup({ email: 'vecin@example.com' });
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  const rows = await c.db.prepare('SELECT * FROM waitlist').all();
  assert.equal(rows.results.length, 1);
  assert.equal(rows.results[0].email, 'vecin@example.com');
  assert.equal(rows.results[0].phone, '+40712000000');
  assert.equal(rows.results[0].source, 'utm_source=Facebook');
  assert.ok(rows.results[0].consent_at);
  assert.equal(c.notifications.length, 2);
});

test('list and CSV require the correct access key', async (t) => {
  const c = await campaign(t);
  await c.signup();
  for (const path of ['/api/waitlist/subscribers', '/api/waitlist/export']) {
    for (const credential of [null, 'wrong-key']) {
      const denied = await c.get(path, credential);
      assert.equal(denied.status, 401);
      assert.equal((await denied.json()).error, 'unauthorized');
    }
    const allowed = await c.get(path);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('cache-control'), 'no-store');
  }
  const legacyExport = await c.get(`/api/waitlist/export?key=${key}`, null);
  assert.equal(legacyExport.status, 200);
});

test('campaign pagination and search return matching rows', async (t) => {
  const c = await campaign(t);
  await c.signup({ email: 'vecin000@example.com', source: 'Facebook' });
  await c.db.batch(Array.from({ length: 54 }, (_, i) =>
    c.db.prepare("INSERT INTO waitlist (email, consent_at) VALUES (?, ?)")
      .bind(`vecin${String(i + 1).padStart(3, '0')}@example.com`, '2026-11-23T08:00:00Z')));

  const first = await (await c.get('/api/waitlist/subscribers')).json();
  assert.equal(first.total, 55);
  assert.equal(first.items.length, 50);
  assert.equal(first.items[0].email, 'vecin054@example.com');
  const second = await (await c.get('/api/waitlist/subscribers?page=2')).json();
  assert.equal(second.items.length, 5);
  assert.equal(second.page, 2);
  const searched = await (await c.get('/api/waitlist/subscribers?q=VECIN00')).json();
  assert.equal(searched.total, 10);
  assert.ok(searched.items.every(item => item.email.startsWith('vecin00')));
  const source = await (await c.get('/api/waitlist/subscribers?q=facebook')).json();
  assert.equal(source.total, 1);
  const literal = await (await c.get('/api/waitlist/subscribers?q=%25')).json();
  assert.equal(literal.total, 0);
  assert.equal((await c.get('/api/waitlist/subscribers?page=-1')).status, 400);
});

test('CSV preserves Romanian characters, quoted fields, and Excel encoding', async (t) => {
  const c = await campaign(t);
  await c.signup({ phone: '+40712000000', source: 'Vecini, "Băneasa"\ngrup' });
  const response = await c.get('/api/waitlist/export');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes);
  assert.ok(csv.startsWith('email,telefon,data_inscrierii,data_acord,sursa,tara\r\n'));
  assert.ok(csv.includes('"vecin@example.com","+40712000000"'));
  assert.ok(csv.includes('"Vecini, ""Băneasa""\ngrup"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(response.headers.get('content-disposition').includes('greengo-lista-lansare.csv'));
});

test('CSV prevents formulas and respects the current search', async (t) => {
  const c = await campaign(t);
  await c.signup({ email: 'first@example.com', source: '=1+1' });
  await c.signup({ email: 'second@example.com', source: 'Facebook' });
  const all = await (await c.get('/api/waitlist/export')).text();
  assert.ok(all.includes('"\'=1+1"'));
  const searched = await (await c.get('/api/waitlist/export?q=facebook')).text();
  assert.ok(searched.includes('second@example.com'));
  assert.ok(!searched.includes('first@example.com'));
});

test('an empty campaign can be listed and exported', async (t) => {
  const c = await campaign(t);
  const data = await (await c.get('/api/waitlist/subscribers')).json();
  assert.deepEqual(data, { ok: true, items: [], total: 0, page: 1, pageSize: 50 });
  const csv = await (await c.get('/api/waitlist/export')).text();
  assert.equal(csv, 'email,telefon,data_inscrierii,data_acord,sursa,tara\r\n');
  assert.equal(c.notifications.length, 0);
});
