import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../lansare/lansare.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function page() {
  let now = 0;
  const forms = [];
  const requests = [];
  function input(value = '') {
    return { value, checked: true, removeAttribute() {}, setAttribute() {}, focus() {} };
  }
  function form() {
    const f = {
      elements: {
        email: input('vecin@example.com'), phone: input('0712000000'),
        consent: input(), website: input(),
      },
      button: { disabled: false, textContent: 'Anunță-mă la lansare' },
      message: { textContent: '' },
      done: null,
      querySelector(selector) {
        if (selector === '.msg') return this.message;
        if (selector === '.go') return this.button;
        throw new Error(`Unexpected selector: ${selector}`);
      },
      querySelectorAll(selector) {
        assert.equal(selector, '.field');
        return [];
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
  const mounts = Array.from({ length: 2 }, () => ({ appendChild() {} }));
  const document = {
    getElementById(id) {
      return id === 'tpl-form' ? { content: { firstElementChild: { cloneNode: form } } } : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-form-mount]') return mounts;
      if (selector === '.wl .go') return forms.filter(f => !f.done).map(f => f.button);
      if (selector === '.wl:not(.done)') return forms.filter(f => !f.done);
      throw new Error(`Unexpected selector: ${selector}`);
    },
    createElement() {
      return { className: '', innerHTML: '', querySelector() { return { addEventListener() {} }; } };
    },
    addEventListener() {},
  };
  const window = {
    matchMedia() { return { matches: true }; },
    addEventListener() {}, dispatchEvent() {},
  };
  class PageDate extends Date { static now() { return now; } }
  vm.runInNewContext(script, {
    window, document, Date: PageDate, location: { search: '?utm_source=test' },
    CustomEvent: class {},
    fetch(url, options) {
      return new Promise((resolve, reject) => { requests.push({ url, options, resolve, reject }); });
    },
  });
  now = 3000;
  return { forms, requests, setTime(value) { now = value; } };
}

test('both launch forms share a single in-flight submission and confirm after success', async () => {
  const { forms, requests } = page();
  forms[0].submit();
  forms[0].submit();
  forms[1].submit();

  assert.equal(requests.length, 1);
  assert.ok(forms.every(f => f.button.disabled && !f.done));
  assert.equal(requests[0].url, '/api/waitlist');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    email: 'vecin@example.com', phone: '+40712000000',
    consent: true, source: 'utm_source=test', website: '',
  });

  requests[0].resolve(Response.json({ ok: true, emailed: false }));
  await settle();
  assert.ok(forms.every(f => f.done && f.done.innerHTML.includes('echipa GreenGO')));
  forms[1].submit();
  assert.equal(requests.length, 1);
});

test('an email API failure preserves the form and allows retry', async () => {
  const { forms, requests } = page();
  forms[0].submit();
  requests[0].resolve(Response.json({ ok: false, error: 'notification' }, { status: 502 }));
  await settle();

  assert.ok(forms.every(f => !f.done && !f.button.disabled));
  assert.ok(forms[0].message.textContent.includes('Nu am putut trimite'));
  assert.equal(forms[0].elements.email.value, 'vecin@example.com');
  forms[0].submit();
  assert.equal(requests.length, 2);
  requests[1].resolve(Response.json({ ok: true }));
  await settle();
  assert.ok(forms.every(f => f.done));
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
  state.requests[0].resolve(Response.json({ ok: true }));
  await settle();
  assert.ok(state.forms.every(f => f.done));
});
