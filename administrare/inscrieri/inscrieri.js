(function () {
    'use strict';

    const accessForm = document.getElementById('access-form');
    const keyInput = document.getElementById('access-key');
    const accessStatus = document.getElementById('access-status');
    const panel = document.getElementById('campaign-panel');
    const search = document.getElementById('search');
    const rows = document.getElementById('subscribers');
    const status = document.getElementById('list-status');
    const previous = document.getElementById('previous');
    const next = document.getElementById('next');
    const download = document.getElementById('download');
    const refresh = document.getElementById('refresh');
    const dateFormat = new Intl.DateTimeFormat('ro-RO', {
        timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short',
    });
    let accessKey = '';
    let page = 1;
    let pages = 1;
    let controller;
    let searchTimer;

    function showLogin(message) {
        if (controller) controller.abort();
        clearTimeout(searchTimer);
        accessKey = '';
        keyInput.value = '';
        rows.replaceChildren();
        panel.hidden = true;
        accessForm.hidden = false;
        accessStatus.textContent = message || '';
        keyInput.focus();
    }

    function setLoading(loading) {
        panel.setAttribute('aria-busy', String(loading));
        refresh.disabled = loading;
        previous.disabled = loading || page <= 1;
        next.disabled = loading || page >= pages;
        accessForm.querySelector('button').disabled = loading;
    }

    function render(items) {
        rows.replaceChildren();
        if (!items.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.className = 'empty';
            cell.textContent = search.value.trim() ? 'Nicio înscriere găsită.' : 'Nu există încă înscrieri.';
            row.appendChild(cell);
            rows.appendChild(row);
            return;
        }
        items.forEach(item => {
            const row = document.createElement('tr');
            const created = new Date(item.created_at.replace(' ', 'T') + 'Z');
            const values = [
                item.email, item.phone || '-',
                Number.isNaN(created.getTime()) ? item.created_at : dateFormat.format(created),
                item.source || '/lansare/',
            ];
            values.forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });
            rows.appendChild(row);
        });
    }

    async function loadPage(requestedPage) {
        if (!accessKey) return;
        if (controller) controller.abort();
        const current = controller = new AbortController();
        setLoading(true);
        status.className = 'status';
        status.textContent = 'Se încarcă înscrierile...';
        const params = new URLSearchParams({ page: String(requestedPage), q: search.value.trim() });
        try {
            const response = await fetch('/api/waitlist/subscribers?' + params, {
                headers: { Authorization: 'Bearer ' + accessKey },
                cache: 'no-store', signal: current.signal,
            });
            if (response.status === 401) {
                showLogin('Parola de acces nu este corectă.');
                return;
            }
            if (!response.ok) throw new Error('list');
            const data = await response.json();
            if (!data.ok || !Array.isArray(data.items)) throw new Error('list');
            page = data.page;
            pages = Math.max(1, Math.ceil(data.total / data.pageSize));
            document.getElementById('total').textContent = data.total;
            document.getElementById('page-label').textContent = `Pagina ${page} din ${pages}`;
            render(data.items);
            accessForm.hidden = true;
            keyInput.value = '';
            panel.hidden = false;
            status.textContent = '';
            accessStatus.textContent = '';
        } catch (error) {
            if (error.name === 'AbortError') return;
            const message = 'Lista nu este disponibilă momentan. Încearcă din nou.';
            if (panel.hidden) accessStatus.textContent = message;
            else { status.className = 'status error'; status.textContent = message; }
        } finally {
            if (current === controller) setLoading(false);
        }
    }

    accessForm.addEventListener('submit', event => {
        event.preventDefault();
        accessKey = keyInput.value.trim();
        search.value = '';
        accessStatus.textContent = '';
        loadPage(1);
    });
    refresh.addEventListener('click', () => loadPage(page));
    previous.addEventListener('click', () => loadPage(page - 1));
    next.addEventListener('click', () => loadPage(page + 1));
    search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadPage(1), 250);
    });
    document.getElementById('logout').addEventListener('click', () => showLogin());

    download.addEventListener('click', async () => {
        if (!accessKey || download.disabled) return;
        const key = accessKey;
        download.disabled = true;
        status.className = 'status';
        status.textContent = 'Se pregătește exportul...';
        try {
            const params = new URLSearchParams({ q: search.value.trim() });
            const response = await fetch('/api/waitlist/export?' + params, {
                headers: { Authorization: 'Bearer ' + key }, cache: 'no-store',
            });
            if (accessKey !== key) return;
            if (response.status === 401) {
                showLogin('Parola de acces nu este corectă.');
                return;
            }
            if (!response.ok) throw new Error('export');
            const blob = await response.blob();
            if (accessKey !== key) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'greengo-lista-lansare.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status.textContent = 'Fișierul CSV a fost descărcat.';
        } catch {
            if (accessKey === key) {
                status.className = 'status error';
                status.textContent = 'Nu am putut genera exportul. Încearcă din nou.';
            }
        } finally {
            download.disabled = false;
        }
    });
})();
