const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../merchants.js'), 'utf8');

class Element {
    constructor() {
        this.children = [];
        this.dataset = {};
        this.textContent = '';
        this.hidden = false;
        this.listeners = {};
    }

    appendChild(child) {
        this.children.push(child);
        child.parent = this;
    }

    replaceChildren(...children) {
        this.children = [];
        children.forEach(child => this.appendChild(child));
    }

    replaceWith(other) {
        const index = this.parent.children.indexOf(this);
        this.parent.children[index] = other;
        other.parent = this.parent;
    }

    addEventListener(event, callback) {
        this.listeners[event] = callback;
    }
}

async function render(layout, response) {
    const list = new Element();
    list.dataset.layout = layout;
    const status = new Element();
    const count = new Element();
    const errors = [];
    const urls = [];
    const nodes = { 'merchant-list': list, 'merchant-status': status, 'merchant-count': count };
    const document = {
        getElementById: id => nodes[id] || null,
        createElement: tag => Object.assign(new Element(), { tag })
    };
    vm.runInNewContext(source, {
        document,
        fetch: async url => {
            urls.push(url);
            if (response instanceof Error) throw response;
            return response;
        },
        console: { error: (...args) => errors.push(args) }
    });
    await new Promise(resolve => setImmediate(resolve));
    return { list, status, count, errors, urls };
}

const merchants = [
    { id: 1, name: '<Restaurant>', image: 'data:image/png;base64,abc', isTempClosed: false },
    { id: 5, name: 'Restaurant nou', image: null, isTempClosed: true }
];
const ok = data => ({ ok: true, json: async () => data });

for (const layout of ['landing', 'launch']) {
    test(`${layout} renders backend merchants and coming-soon badge`, async () => {
        const { list, status, count, urls } = await render(layout, ok({ merchants }));
        assert.deepEqual(urls, ['https://app.green-go.ro/api/merchant/name']);
        assert.equal(list.children.length, 2);
        assert.equal(status.hidden, true);
        assert.equal(count.textContent, '1');
        const first = list.children[0];
        const closed = list.children[1];
        assert.equal(first.tag, layout === 'landing' ? 'a' : 'div');
        if (layout === 'landing') {
            assert.equal(first.href, 'https://app.green-go.ro/merchant/menu?id=1');
            assert.equal(first.children[0].children[0].src, merchants[0].image);
            assert.equal(first.children[1].textContent, '<Restaurant>');
            assert.equal(closed.children[0].children[0].textContent, 'Imagine indisponibilă');
        } else {
            assert.equal(first.children[0].src, merchants[0].image);
            assert.equal(first.children[1].textContent, '<Restaurant>');
            assert.equal(first.children[2].textContent, 'La lansare');
            assert.equal(closed.children[0].textContent, 'Imagine indisponibilă');
        }
        assert.equal(closed.children[2].textContent, 'În curând');
        const image = layout === 'landing' ? first.children[0].children[0] : first.children[0];
        image.listeners.error();
        const fallback = layout === 'landing' ? first.children[0].children[0] : first.children[0];
        assert.equal(fallback.textContent, 'Imagine indisponibilă');
    });

    test(`${layout} handles an empty merchant list`, async () => {
        const { list, status, count } = await render(layout, ok({ merchants: [] }));
        assert.equal(list.children.length, 0);
        assert.equal(count.textContent, '0');
        assert.equal(status.hidden, false);
        assert.match(status.textContent, /nu sunt restaurante/);
    });

    for (const [label, response] of [
        ['network failure', new Error('offline')],
        ['HTTP error', { ok: false, status: 500 }],
        ['malformed response', ok({ merchants: [{ id: 1 }] })]
    ]) {
        test(`${layout} reports ${label}`, async () => {
            const { list, status, count, errors } = await render(layout, response);
            assert.equal(list.children.length, 0);
            assert.equal(count.textContent, '—');
            assert.match(status.textContent, /Nu am putut/);
            assert.equal(errors.length, 1);
        });
    }
}
