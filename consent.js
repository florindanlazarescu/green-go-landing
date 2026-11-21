/*!
 * GreenGO – consimțământ cookie-uri (GDPR + Legea 506/2004)
 *
 * CUM ADAUGI UN PIXEL / ANALYTICS (nu se încarcă până nu utilizatorul acceptă categoria):
 *
 *   Script cu sursă externă:
 *     <script type="text/plain" data-consent="marketing" data-src="https://connect.facebook.net/en_US/fbevents.js"></script>
 *
 *   Script inline:
 *     <script type="text/plain" data-consent="analytics">
 *       /* codul de inițializare aici *​/
 *     </script>
 *
 *   Categorii: "analytics" (Google Analytics, Hotjar...) și "marketing" (Meta Pixel, TikTok, Google Ads...).
 *
 * Google Consent Mode v2: valorile implicite sunt "denied" și se actualizează după alegere.
 * API: GreenGoConsent.open() | .has('analytics') | eveniment 'greengo:consent' pe document.
 */
(function () {
    'use strict';

    var KEY = 'greengo_consent_v1';
    var MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // alegerea se reține 6 luni, apoi se cere din nou
    var CATEGORIES = ['analytics', 'marketing'];

    // ---------- stocare ----------
    function read() {
        try {
            var raw = window.localStorage.getItem(KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || typeof data.ts !== 'number' || Date.now() - data.ts > MAX_AGE_MS) return null;
            return data;
        } catch (e) { return null; }
    }

    function write(choice) {
        var data = { ts: Date.now(), analytics: !!choice.analytics, marketing: !!choice.marketing };
        try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* fără stocare: se va cere din nou */ }
        return data;
    }

    // ---------- Google Consent Mode v2 ----------
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        wait_for_update: 500
    });

    function updateConsentMode(c) {
        gtag('consent', 'update', {
            analytics_storage: c.analytics ? 'granted' : 'denied',
            ad_storage: c.marketing ? 'granted' : 'denied',
            ad_user_data: c.marketing ? 'granted' : 'denied',
            ad_personalization: c.marketing ? 'granted' : 'denied'
        });
    }

    // ---------- activare scripturi blocate ----------
    var activated = {};
    function activateScripts(c) {
        var nodes = document.querySelectorAll('script[type="text/plain"][data-consent]');
        Array.prototype.forEach.call(nodes, function (node) {
            var cat = node.getAttribute('data-consent');
            if (!c[cat] || node.getAttribute('data-consent-done')) return;
            node.setAttribute('data-consent-done', '1');
            var s = document.createElement('script');
            Array.prototype.forEach.call(node.attributes, function (a) {
                if (a.name === 'type' || a.name === 'data-src' || a.name === 'data-consent' || a.name === 'data-consent-done') return;
                s.setAttribute(a.name, a.value);
            });
            var src = node.getAttribute('data-src');
            if (src) { s.src = src; } else { s.text = node.text; }
            node.parentNode.insertBefore(s, node.nextSibling);
            activated[cat] = true;
        });
    }

    function apply(c) {
        updateConsentMode(c);
        activateScripts(c);
        try { document.dispatchEvent(new CustomEvent('greengo:consent', { detail: c })); } catch (e) { /* IE */ }
    }

    // ---------- interfață ----------
    var root = null, lastFocus = null;

    function el(tag, attrs, html) {
        var n = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        if (html) n.innerHTML = html;
        return n;
    }

    function build() {
        root = el('div', { id: 'consent-root', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'consent-title', 'aria-describedby': 'consent-desc' });
        root.innerHTML =
            '<div class="consent-card">' +
              '<div class="consent-main">' +
                '<h2 id="consent-title">Folosim cookie-uri</h2>' +
                '<p id="consent-desc">Folosim cookie-uri necesare pentru funcționarea site-ului. Cu acordul tău, folosim și cookie-uri de analiză și de marketing, ca să îmbunătățim GreenGO și să măsurăm reclamele. Poți alege oricând. Detalii în <a href="Legal/Politica%20Cookie%20Green%20GO%20Delivery.html">Politica Cookie</a>.</p>' +
              '</div>' +
              '<div class="consent-prefs" hidden>' +
                '<label class="consent-row"><span><strong>Necesare</strong><small>Fac site-ul să funcționeze. Nu pot fi dezactivate.</small></span><input type="checkbox" checked disabled></label>' +
                '<label class="consent-row"><span><strong>Analiză</strong><small>Ne arată cum este folosit site-ul (pagini vizitate, erori).</small></span><input type="checkbox" data-cat="analytics"></label>' +
                '<label class="consent-row"><span><strong>Marketing</strong><small>Măsoară reclamele și ne ajută să ajungem la oamenii potriviți.</small></span><input type="checkbox" data-cat="marketing"></label>' +
              '</div>' +
              '<div class="consent-actions">' +
                '<button type="button" class="consent-btn" data-act="reject">Refuz toate</button>' +
                '<button type="button" class="consent-btn consent-btn-link" data-act="prefs">Setări</button>' +
                '<button type="button" class="consent-btn consent-btn-save" data-act="save" hidden>Salvează alegerea</button>' +
                '<button type="button" class="consent-btn" data-act="accept">Accept toate</button>' +
              '</div>' +
            '</div>';
        document.body.appendChild(root);
        root.addEventListener('click', onClick);
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && read()) close(); // Esc închide doar dacă există deja o alegere
        });
    }

    function setChecks(c) {
        Array.prototype.forEach.call(root.querySelectorAll('input[data-cat]'), function (i) {
            i.checked = !!c[i.getAttribute('data-cat')];
        });
    }

    function showPrefs(show) {
        root.querySelector('.consent-prefs').hidden = !show;
        root.querySelector('[data-act="save"]').hidden = !show;
        root.querySelector('[data-act="prefs"]').hidden = show;
        root.classList.toggle('consent-expanded', show);
    }

    function save(choice) {
        var before = read() || {};
        var data = write(choice);
        var revoked = CATEGORIES.some(function (k) { return before[k] && !data[k]; });
        close();
        if (revoked) { window.location.reload(); return; } // scripturile deja pornite nu pot fi oprite fără reîncărcare
        apply(data);
    }

    function onClick(e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'accept') save({ analytics: true, marketing: true });
        else if (act === 'reject') save({ analytics: false, marketing: false });
        else if (act === 'prefs') showPrefs(true);
        else if (act === 'save') {
            var choice = {};
            Array.prototype.forEach.call(root.querySelectorAll('input[data-cat]'), function (i) { choice[i.getAttribute('data-cat')] = i.checked; });
            save(choice);
        }
    }

    function open() {
        if (!root) build();
        lastFocus = document.activeElement;
        setChecks(read() || {});
        showPrefs(!!read());           // dacă există o alegere veche, se deschide direct pe setări
        root.hidden = false;
        document.documentElement.classList.add('consent-open');
        var first = root.querySelector('.consent-btn:not([hidden])');
        if (first) first.focus();
    }

    function close() {
        if (root) root.hidden = true;
        document.documentElement.classList.remove('consent-open');
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }

    // ---------- pornire ----------
    window.GreenGoConsent = {
        open: open,
        has: function (cat) { var c = read(); return !!(c && c[cat]); }
    };

    function init() {
        var stored = read();
        if (stored) apply(stored); else open();
        document.addEventListener('click', function (e) {
            var t = e.target.closest('[data-open-consent]');
            if (t) { e.preventDefault(); open(); }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
