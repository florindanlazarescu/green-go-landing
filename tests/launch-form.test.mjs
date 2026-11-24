import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../lansare/lansare.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function page({ search = '?utm_source=facebook&utm_campaign=lansare&fbclid=x', session = {} } = {}) {
  let now = 0;
  const forms = [];
  const requests = [];
  const dataLayer = [];
  const leads = [];
  const sessionStore = { ...session };
  const local = {};
  function el(extra = {}) {
    return {
      attrs: {}, textContent: '', id: '',
      setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
      getAttribute(k) { return this.attrs[k] ?? null; },
      focus() {}, addEventListener() {}, querySelector() { return el(); },
      ...extra,
    };
  }
  function form() {
    const label = el(), email = el({ value: 'vecin@example.com' }), privacy = el(), msg = el(), goLabel = el();
    const button = el({ disabled: false, innerHTML: '', querySelector: () => goLabel });
    const f = {
      elements: { email, website: el({ value: '' }) },
      button, goLabel, message: msg, done: null,
      querySelector(selector) {
        return {
          label, 'input[type="email"]': email, '.privacy': privacy, '.msg': msg, '.go-label': goLabel, '.go': button,
        }[selector] ?? (() => { throw new Error(`Unexpected selector: ${selector}`); })();
      },
      addEventListener(event, handler) {
        assert.equal(event, 'submit');
        this.submit = () => handler({ preventDefault() {} });
      },
      replaceWith(node) { this.done = node; },
    };
    forms.push(f);
    return f;
  }
  const ctas = ['Anunță-mă la lansare', 'Vreau să fiu anunțat la lansare', 'Anunță-mă când se lansează GreenGO'];
  const ids = ['hero', 'offer', 'final'];
  const mounts = ctas.map((cta, i) => ({
    appendChild() {}, getAttribute: k => ({ 'data-cta': cta, 'data-form-id': ids[i] })[k] ?? null,
  }));
  const document = {
    getElementById(id) {
      return id === 'tpl-form' ? { content: { firstElementChild: { cloneNode: form } } } : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-form-mount]') return mounts;
      throw new Error(`Unexpected selector: ${selector}`);
    },
    createElement() {
      return el({ className: '', innerHTML: '' });
    },
    addEventListener() {},
  };
  const storage = store => ({ getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });
  const window = {
    matchMedia() { return { matches: true }; },
    addEventListener() {},
    dispatchEvent(e) { leads.push(e); },
    dataLayer,
    sessionStorage: storage(sessionStore),
    localStorage: storage(local),
  };
  class PageDate extends Date { static now() { return now; } }
  vm.runInNewContext(script, {
    window, document, Date: PageDate, location: { search },
    CustomEvent: class { constructor(type) { this.type = type; } },
    fetch(url, options) {
      return new Promise((resolve, reject) => { requests.push({ url, options, resolve, reject }); });
    },
  });
  now = 3000;
  return { forms, requests, dataLayer, leads, sessionStore, local, setTime(value) { now = value; } };
}

const events = dataLayer => dataLayer.map(e => e.event);

test('all launch forms share one in-flight email-only submission with UTM attribution', async () => {
  const { forms, requests, dataLayer, leads, sessionStore, local } = page();
  assert.deepEqual(forms.map(f => f.goLabel.textContent), [
    'Anunță-mă la lansare', 'Vreau să fiu anunțat la lansare', 'Anunță-mă când se lansează GreenGO',
  ]);
  assert.equal(sessionStore.greengo_utm, 'utm_source=facebook&utm_campaign=lansare');

  forms[1].submit();
  forms[1].submit();
  forms[0].submit();
  assert.equal(requests.length, 1);
  assert.ok(forms.every(f => f.button.disabled && !f.done));
  assert.equal(requests[0].url, '/api/waitlist');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    email: 'vecin@example.com', consent: true,
    source: 'utm_source=facebook&utm_campaign=lansare&form=offer', website: '',
  });
  assert.ok(!requests[0].options.body.includes('phone'));

  requests[0].resolve(Response.json({ ok: true, emailed: false, duplicate: false }));
  await settle();
  assert.ok(forms[1].done.innerHTML.includes('Ești pe lista GreenGO!'));
  assert.ok(forms[1].done.innerHTML.includes('Spune-i și unui vecin'));
  assert.ok(forms[0].done && forms[2].done);
  assert.deepEqual(events(dataLayer), ['greengo_PageView', 'greengo_Lead']);
  assert.equal(dataLayer[1].form, 'offer');
  assert.ok(!JSON.stringify(dataLayer).includes('vecin@example.com'), 'the email never reaches tracking');
  assert.equal(leads.length, 1);
  assert.equal(local.greengo_launch_signed, '1');
  forms[0].submit();
  assert.equal(requests.length, 1);
});

test('UTM parameters are kept for the rest of the visit', () => {
  const { forms, requests } = page({ search: '', session: { greengo_utm: 'utm_source=tiktok' } });
  forms[0].submit();
  assert.equal(JSON.parse(requests[0].options.body).source, 'utm_source=tiktok&form=hero');
});

test('a duplicate signup is confirmed without a Lead event', async () => {
  const { forms, requests, dataLayer, leads } = page();
  forms[0].submit();
  requests[0].resolve(Response.json({ ok: true, emailed: false, duplicate: true }));
  await settle();
  assert.ok(forms[0].done.innerHTML.includes('Ești deja pe lista GreenGO'));
  assert.deepEqual(events(dataLayer), ['greengo_PageView']);
  assert.equal(leads.length, 0);
});

test('server and network failures keep the form and allow retry', async () => {
  const { forms, requests, dataLayer } = page();
  forms[0].submit();
  requests[0].resolve(Response.json({ ok: false, error: 'notification' }, { status: 502 }));
  await settle();
  assert.ok(forms.every(f => !f.done && !f.button.disabled));
  assert.ok(forms[0].message.textContent.includes('Nu am putut finaliza'));
  assert.equal(forms[0].goLabel.textContent, 'Anunță-mă la lansare');

  forms[0].submit();
  requests[1].reject(new TypeError('offline'));
  await settle();
  assert.ok(forms[0].message.textContent.includes('internetul'));

  forms[0].submit();
  requests[2].resolve(Response.json({ ok: false, error: 'email' }, { status: 400 }));
  await settle();
  assert.ok(forms[0].message.textContent.includes('nu pare corectă'));
  assert.equal(forms[0].elements.email.attrs['aria-invalid'], 'true');
  assert.deepEqual(events(dataLayer), ['greengo_PageView']);
});

test('invalid emails are rejected before any request', () => {
  const { forms, requests } = page();
  forms[0].elements.email.value = 'nu-e-email';
  forms[0].submit();
  assert.equal(requests.length, 0);
  assert.ok(forms[0].message.textContent.includes('nu pare corectă'));
  forms[0].elements.email.value = '   ';
  forms[0].submit();
  assert.equal(requests.length, 0);
  assert.ok(forms[0].message.textContent.includes('Scrie adresa'));
});

test('fast autofill is not shown a false success or silently discarded', async () => {
  const state = page();
  state.setTime(1000);
  state.forms[0].submit();
  assert.equal(state.requests.length, 0);
  assert.ok(state.forms.every(f => !f.done));
  assert.ok(state.forms[0].message.textContent.includes('Așteaptă'));

  state.setTime(3000);
  state.forms[0].submit();
  assert.equal(state.requests.length, 1);
  state.requests[0].resolve(Response.json({ ok: true, duplicate: false }));
  await settle();
  assert.ok(state.forms.every(f => f.done));
});

test('the honeypot never reaches the server or records a Lead', () => {
  const { forms, requests, dataLayer } = page();
  forms[0].elements.website.value = 'spam.example';
  forms[0].submit();
  assert.equal(requests.length, 0);
  assert.deepEqual(events(dataLayer), ['greengo_PageView']);
});
