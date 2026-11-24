(function () {
    'use strict';
    var pageLoadedAt = Date.now();
    var PAGE_URL = 'https://www.green-go.ro/lansare/';
    var WA_URL = 'https://chat.whatsapp.com/EdRMVjhPgU95lKDiJLzgzs';
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var SIGNED_KEY = 'greengo_launch_signed';

    function store(kind) {
        try { return window[kind] || null; } catch (e) { return null; }
    }
    function storeGet(kind, key) {
        var s = store(kind);
        try { return s ? s.getItem(key) : null; } catch (e) { return null; }
    }
    function storeSet(kind, key, value) {
        var s = store(kind);
        try { if (s) s.setItem(key, value); } catch (e) { /* fără stocare: pagina funcționează oricum */ }
    }

    /* ---------- atribuire: parametrii UTM se păstrează pe durata vizitei ---------- */
    var attribution = (function () {
        var search = (typeof location !== 'undefined' && location.search) || '';
        var params = {};
        search.replace(/^\?/, '').split('&').forEach(function (pair) {
            if (!pair) return;
            var i = pair.indexOf('=');
            var k = decodeSafe(i < 0 ? pair : pair.slice(0, i));
            var v = decodeSafe(i < 0 ? '' : pair.slice(i + 1));
            if (UTM_KEYS.indexOf(k) >= 0 && v) params[k] = v.slice(0, 100);
        });
        var found = UTM_KEYS.filter(function (k) { return params[k]; });
        var utm = found.map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
        if (utm) storeSet('sessionStorage', 'greengo_utm', utm);
        else utm = storeGet('sessionStorage', 'greengo_utm') || '';
        // fără UTM: păstrăm comportamentul vechi (query string-ul paginii)
        return utm || search.slice(1);
    })();
    function decodeSafe(s) {
        try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); }
    }

    /* ---------- tracking: respectă consimțământul; nu trimite niciodată adresa de e-mail ---------- */
    var GA4_NAMES = {
        Lead: 'generate_lead', WhatsAppClick: 'whatsapp_click', RestaurantClick: 'restaurant_click',
        ShareClick: 'share', SocialClick: 'social_click', PageView: 'page_view'
    };
    function track(name, params) {
        params = params || {};
        try {
            window.dataLayer = window.dataLayer || [];
            var entry = { event: 'greengo_' + name };
            Object.keys(params).forEach(function (k) { entry[k] = params[k]; });
            window.dataLayer.push(entry);
        } catch (e) { /* dataLayer indisponibil */ }
        if (name === 'PageView') return; // PageView este trimis de scripturile GA4 / Meta la încărcare
        var consent = window.GreenGoConsent;
        try {
            if (typeof window.gtag === 'function' && consent && consent.has('analytics')) {
                window.gtag('event', GA4_NAMES[name] || name, params);
            }
            if (typeof window.fbq === 'function' && consent && consent.has('marketing')) {
                if (name === 'Lead') window.fbq('track', 'Lead', params);
                else window.fbq('trackCustom', name, params);
            }
        } catch (e) { /* un script de tracking blocat nu trebuie să strice pagina */ }
    }
    window.GreenGoTrack = track;
    track('PageView', { page: '/lansare/' });

    document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target : null;
        if (!t) return;
        var link = t.closest('[data-track]');
        if (link) {
            var name = link.getAttribute('data-track');
            var p = {};
            if (link.getAttribute('data-track-place')) p.placement = link.getAttribute('data-track-place');
            if (link.getAttribute('data-track-network')) p.network = link.getAttribute('data-track-network');
            track(name, p);
        }
        var tile = t.closest('#merchant-list a.tile');
        if (tile) {
            var nm = tile.querySelector('.nm');
            track('RestaurantClick', { restaurant: nm ? nm.textContent : '' });
        }
        var jump = t.closest('[data-scroll-form]');
        if (jump) { e.preventDefault(); goToForm(); }
    });

    /* ---------- derulare către formularul principal ---------- */
    function goToForm() {
        var card = document.getElementById('inscriere');
        if (!card) return;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        var input = card.querySelector('input[type="email"]');
        var target = input || card;
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }

    /* ---------- formulare ---------- */
    var tpl = document.getElementById('tpl-form');
    var mounts = document.querySelectorAll('[data-form-mount]');
    var forms = [];
    var submitted = false;
    var submitting = false;
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    var ERRORS = {
        email: 'Adresa de e-mail nu pare corectă. Verific-o și încearcă din nou.',
        consent: 'Nu am putut confirma acordul. Reîncarcă pagina și încearcă din nou.',
        origin: 'Înscrierea trebuie făcută direct de pe green-go.ro.',
        storage: 'Serverul nu a putut salva înscrierea. Încearcă din nou în câteva minute.',
        unavailable: 'Înscrierile sunt temporar indisponibile. Încearcă din nou în câteva minute.',
        notification: 'Nu am putut finaliza înscrierea. Încearcă din nou în câteva secunde.',
        network: 'Nu ne-am putut conecta la server. Verifică internetul și încearcă din nou.'
    };

    function setBusy(busy) {
        forms.forEach(function (f) {
            if (f.done) return;
            var b = f.querySelector('.go');
            b.disabled = busy;
            b.setAttribute('aria-busy', busy ? 'true' : 'false');
            b.innerHTML = busy
                ? '<span class="spin" aria-hidden="true"></span><span>Se trimite...</span>'
                : '<span class="go-label"></span>';
            if (!busy) b.querySelector('.go-label').textContent = f.cta;
        });
    }

    function share(btn) {
        track('ShareClick', { method: navigator.share ? 'native' : 'copy' });
        var data = {
            title: 'GreenGO se lansează în Greenfield',
            text: 'GreenGO, aplicația de livrare a cartierului Greenfield, se lansează în curând. Livrare gratuită la orice comandă până la finalul anului:',
            url: PAGE_URL
        };
        if (navigator.share) {
            navigator.share(data).catch(function () { /* utilizatorul a închis fereastra */ });
            return;
        }
        var label = btn.textContent;
        var copied = navigator.clipboard && navigator.clipboard.writeText
            ? navigator.clipboard.writeText(PAGE_URL)
            : Promise.reject(new Error('clipboard'));
        copied.then(function () {
            btn.textContent = 'Link copiat';
        }, function () {
            btn.textContent = PAGE_URL;
        });
        setTimeout(function () { btn.textContent = label; }, 2600);
    }

    function confirmation(duplicate) {
        var wrap = document.createElement('div');
        wrap.className = 'wl done';
        wrap.setAttribute('tabindex', '-1');
        wrap.setAttribute('role', 'status');
        wrap.innerHTML =
            '<h3>' + (duplicate ? 'Ești deja pe lista GreenGO! 💚' : 'Ești pe lista GreenGO! 💚') + '</h3>' +
            '<p>' + (duplicate
                ? 'Adresa ta era deja înscrisă, nu trebuie să mai faci nimic.'
                : 'Îți mulțumim pentru înscriere!') + '</p>' +
            '<p>Te vom anunța prin e-mail imediat ce aplicația devine disponibilă, pentru a putea instala GreenGO și plasa prima comandă.</p>' +
            '<p class="done-offer">Nu uita: beneficiezi de livrare gratuită la orice comandă până la finalul anului!</p>' +
            '<p class="done-next">Până atunci, rămâi aproape de noi și pe WhatsApp.</p>' +
            '<div class="done-actions">' +
                '<a class="btn btn-wa" href="' + WA_URL + '" target="_blank" rel="noopener" data-track="WhatsAppClick" data-track-place="confirmation">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-wa"/></svg>Alătură-te comunității GreenGO</a>' +
                '<button type="button" class="btn btn-ghost" data-share>Spune-i și unui vecin</button>' +
            '</div>';
        var btn = wrap.querySelector('[data-share]');
        if (btn) btn.addEventListener('click', function () { share(btn); });
        return wrap;
    }

    function mini() {
        var wrap = document.createElement('div');
        wrap.className = 'wl done';
        wrap.innerHTML = '<p class="done-mini"><span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>Ești pe lista GreenGO. Te anunțăm la lansare.</p>';
        return wrap;
    }

    function finish(form, duplicate) {
        submitted = true;
        storeSet('localStorage', SIGNED_KEY, '1');
        forms.forEach(function (f) {
            var node = f === form ? confirmation(duplicate) : mini();
            var card = f.closest ? f.closest('.signup-card') : null;
            if (card) card.classList.add('is-done');
            f.done = node;
            f.replaceWith(node);
            if (f === form && node.focus) { try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); } }
        });
        if (document.documentElement) document.documentElement.classList.add('gg-signed');
        hideSticky(true);
    }

    function friendlyError(code) {
        return ERRORS[code] || ERRORS.notification;
    }

    mounts.forEach(function (mount, idx) {
        var f = tpl.content.firstElementChild.cloneNode(true);
        f.cta = (mount.getAttribute && mount.getAttribute('data-cta')) || 'Anunță-mă la lansare';
        f.formId = (mount.getAttribute && mount.getAttribute('data-form-id')) || String(idx);
        var id = 'wl-' + f.formId;
        var label = f.querySelector('label');
        var email = f.querySelector('input[type="email"]');
        var privacy = f.querySelector('.privacy');
        var msg = f.querySelector('.msg');
        if (label) label.setAttribute('for', id);
        if (email) { email.id = id; email.setAttribute('aria-describedby', id + '-msg ' + id + '-privacy'); }
        if (msg) msg.id = id + '-msg';
        if (privacy) privacy.id = id + '-privacy';
        var go = f.querySelector('.go-label');
        if (go) go.textContent = f.cta;
        mount.appendChild(f);
        forms.push(f);

        f.addEventListener('submit', function (e) {
            e.preventDefault();
            if (submitted || submitting) return;
            var input = f.elements.email;
            input.removeAttribute('aria-invalid');
            msg.textContent = '';

            var ev = input.value.trim();
            if (!ev) { input.setAttribute('aria-invalid', 'true'); msg.textContent = 'Scrie adresa ta de e-mail.'; input.focus(); return; }
            if (!EMAIL_RE.test(ev) || ev.length > 254) {
                input.setAttribute('aria-invalid', 'true');
                msg.textContent = 'Adresa de e-mail nu pare corectă. Exemplu: nume@email.ro';
                input.focus();
                return;
            }
            // capcana pentru roboți: nu trimitem nimic și nu înregistrăm Lead
            if (f.elements.website.value) { finish(f, false); return; }
            if (Date.now() - pageLoadedAt < 2000) {
                msg.textContent = 'Așteaptă câteva secunde și încearcă din nou.';
                return;
            }

            submitting = true;
            setBusy(true);
            var source = attribution;
            source = (source ? source + '&' : '') + 'form=' + f.formId;
            fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: ev, consent: true, source: source.slice(0, 200), website: f.elements.website.value })
            }).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j && j.ok === true, j: j || {} }; });
            }, function () {
                return { ok: false, j: { error: 'network' } };
            }).then(function (res) {
                submitting = false;
                setBusy(false);
                if (!res.ok) {
                    var code = res.j.error || 'notification';
                    if (code === 'email') input.setAttribute('aria-invalid', 'true');
                    msg.textContent = friendlyError(code);
                    return;
                }
                var duplicate = res.j.duplicate === true;
                if (!duplicate) {
                    // Lead numai după confirmarea serverului că înscrierea este nouă
                    track('Lead', { form: f.formId });
                    try { window.dispatchEvent(new CustomEvent('greengo:lead')); } catch (e2) { /* fără CustomEvent */ }
                }
                finish(f, duplicate);
            });
        });
    });

    /* ---------- CTA lipicios pe mobil ---------- */
    var sticky = document.getElementById('sticky-cta');
    var stickyOff = storeGet('localStorage', SIGNED_KEY) === '1';
    function hideSticky(forever) {
        if (forever) stickyOff = true;
        if (!sticky) return;
        sticky.classList.remove('show');
        if (forever) sticky.hidden = true;
    }
    (function stickyCta() {
        var hero = document.getElementById('inscriere');
        if (!sticky || !hero || typeof IntersectionObserver === 'undefined') return;
        var heroPassed = false;
        var visibleForms = 0;
        function update() {
            if (stickyOff) return hideSticky(true);
            var show = heroPassed && visibleForms === 0;
            sticky.hidden = false;
            sticky.classList.toggle('show', show);
            sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
            Array.prototype.forEach.call(sticky.querySelectorAll('a'), function (a) { a.tabIndex = show ? 0 : -1; });
        }
        new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { heroPassed = !en.isIntersecting && en.boundingClientRect.top < 0; });
            update();
        }).observe(hero);
        var others = document.querySelectorAll('.offer-form, .final-form');
        var seen = new Map();
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { seen.set(en.target, en.isIntersecting); });
            visibleForms = 0;
            seen.forEach(function (v) { if (v) visibleForms++; });
            update();
        });
        Array.prototype.forEach.call(others, function (el) { io.observe(el); });
    })();
})();
