(function () {
    'use strict';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var pageLoadedAt = Date.now();

    /* ---------- lumină care urmărește cursorul ---------- */
    if (finePointer && !reduce) {
        var raf = 0;
        window.addEventListener('pointermove', function (e) {
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                document.documentElement.style.setProperty('--mx', e.clientX + 'px');
                document.documentElement.style.setProperty('--my', e.clientY + 'px');
            });
        }, { passive: true });
    }

    /* ---------- harta Greenfield: blocuri, curier, cronometru, categorii ---------- */
    (function map() {
        var NS = 'http://www.w3.org/2000/svg';
        var housesG = document.getElementById('houses');
        var route = document.getElementById('route');
        var rider = document.getElementById('rider');
        var glow = document.getElementById('rider-glow');
        var clockT = document.getElementById('clock-t');
        var clockL = document.getElementById('clock-l');
        var clock = document.getElementById('clock');
        var card = document.getElementById('map-card');
        var svg = document.getElementById('map-svg');
        var bubble = document.getElementById('bubble');
        var bubbleT = document.getElementById('bubble-t');
        var chips = document.querySelectorAll('#chips button');
        if (!housesG || !route) return;

        var CATS = ['Mic dejun', 'Prânz', 'Cină', 'Dulciuri', 'Cumpărături'];

        // axele străzilor reale (px din harta OSM), ca să nu punem clădiri peste ele
        var roads = [
            [[-20, 217], [720, 565]], [[250, 347], [610, 358]], [[222, 222], [270, 260], [440, 288], [610, 295]],
            [[215, 90], [212, 200], [222, 225], [200, 322]], [[300, 75], [300, 265]], [[300, 172], [396, 172]],
            [[300, 112], [392, 112]], [[610, 295], [610, 500]], [[525, 358], [525, 485]], [[440, 358], [440, 445]]
        ];
        function dseg(px, py, a, b) {
            var dx = b[0] - a[0], dy = b[1] - a[1], t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy);
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
        }
        function nearRoad(px, py, min) {
            for (var i = 0; i < roads.length; i++) for (var k = 0; k < roads[i].length - 1; k++) if (dseg(px, py, roads[i][k], roads[i][k + 1]) < min) return true;
            return false;
        }
        // zonele construite din Greenfield: [x0, y0, x1, y1]
        var zones = [[200, 96, 272, 218], [304, 96, 396, 270], [272, 298, 604, 345], [380, 364, 518, 480], [530, 366, 604, 480], [305, 362, 372, 400]];
        var seed = 11;
        function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
        zones.forEach(function (z) {
            for (var x = z[0]; x + 14 <= z[2]; x += 20) {
                for (var y = z[1]; y + 11 <= z[3]; y += 16) {
                    var cx = x + 7, cy = y + 5.5;
                    if (rnd() < .2) continue;
                    if (nearRoad(cx, cy, 9.5)) continue;
                    if (cx > 350 && cx < 410 && cy > 180 && cy < 276) continue; // pietonalul
                    if (cx > 303 && cx < 345 && cy > 282 && cy < 336) continue;  // parcul
                    if (cx < 385 && cy < 124) continue;                          // sub cronometru
                    var r = document.createElementNS(NS, 'rect');
                    r.setAttribute('class', 'house');
                    r.setAttribute('x', x); r.setAttribute('y', y);
                    r.setAttribute('width', 14); r.setAttribute('height', 11); r.setAttribute('rx', 2.5);
                    housesG.appendChild(r);
                }
            }
        });

        // câte un traseu pe categorie: pe străzile reale, din puncte diferite ale cartierului
        var ROUTES = [
            'M300 168L300 265L440 288L560 293',
            'M525 485L525 355.4L310 348.8',
            'M610 480L610 295L440 288L270 260',
            'M213 150L212 200L222 225L270 260L440 288L500 290.5',
            'M560 490L200 320.5'
        ];
        var ghost = document.getElementById('route-ghost');
        var pinS = document.getElementById('pin-start'), pinE = document.getElementById('pin-end');
        var L = 0;
        var cat = 0;
        function setRoute(d) {
            route.setAttribute('d', d); ghost.setAttribute('d', d);
            L = route.getTotalLength();
            route.style.strokeDasharray = L;
            var s = route.getPointAtLength(0), e = route.getPointAtLength(L);
            pinS.setAttribute('transform', 'translate(' + s.x + ' ' + s.y + ')');
            pinE.setAttribute('transform', 'translate(' + e.x + ' ' + e.y + ')');
        }

        function setCat(i) {
            cat = (i + CATS.length) % CATS.length;
            setRoute(ROUTES[cat]);
            card.setAttribute('data-cat', cat);
            bubbleT.textContent = CATS[cat];
            chips.forEach(function (b, k) { b.setAttribute('aria-pressed', k === cat ? 'true' : 'false'); });
        }

        function place(p) {
            route.style.strokeDashoffset = L * (1 - p);
            var pt = route.getPointAtLength(L * p);
            rider.setAttribute('cx', pt.x); rider.setAttribute('cy', pt.y);
            glow.setAttribute('cx', pt.x); glow.setAttribute('cy', pt.y);
            var secs = Math.max(0, Math.round(20 * 60 * (1 - p)));
            var m = Math.floor(secs / 60), s = secs % 60;
            clockT.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            // bula urmărește curierul
            var sp = svg.createSVGPoint(); sp.x = pt.x; sp.y = pt.y;
            var m2 = rider.getScreenCTM();
            if (m2) {
                var q = sp.matrixTransform(m2), cr = card.getBoundingClientRect();
                bubble.style.left = (q.x - cr.left) + 'px';
                bubble.style.top = (q.y - cr.top) + 'px';
            }
        }

        var RUN = 8000, HOLD = 2600, start = 0;
        chips.forEach(function (b) {
            b.addEventListener('click', function () { setCat(+b.getAttribute('data-i')); start = 0; });
        });
        setCat(0);

        if (reduce) { place(1); clockT.textContent = '20 min'; clockL.textContent = 'timp mediu de livrare'; bubble.style.display = 'none'; return; }

        function ease(t) { return .5 - Math.cos(Math.PI * t) / 2; }
        var lastRun = -1;
        function frame(now) {
            if (!start) { start = now; lastRun = 0; }
            var cycle = RUN + HOLD, el = now - start;
            var run = Math.floor(el / cycle), t = el % cycle;
            if (run !== lastRun) { lastRun = run; setCat(cat + 1); }
            if (t < RUN) {
                clock.classList.remove('arrived');
                bubble.style.opacity = 1;
                clockL.textContent = 'minute până la ușa ta';
                place(ease(t / RUN));
            } else {
                place(1);
                bubble.style.opacity = 0;
                if (!clock.classList.contains('arrived')) {
                    clock.classList.add('arrived');
                    clockL.textContent = 'Ai ajuns acasă. Poftă bună!';
                }
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    })();

    /* ---------- telefoane care răspund la cursor ---------- */
    (function tilt() {
        var box = document.getElementById('phones');
        if (!box || reduce || !finePointer) return;
        var phones = box.querySelectorAll('.phone');
        box.addEventListener('pointermove', function (e) {
            var r = box.getBoundingClientRect();
            var dx = (e.clientX - r.left) / r.width - .5;
            var dy = (e.clientY - r.top) / r.height - .5;
            phones.forEach(function (p, i) {
                var k = i ? 1 : -1;
                var base = i ? 5 : -6;
                p.style.transform = 'rotate(' + (base + dx * 6 * k) + 'deg) translate(' + (dx * 14 * k) + 'px,' + (dy * 12) + 'px)';
            });
        });
        box.addEventListener('pointerleave', function () {
            phones.forEach(function (p, i) { p.style.transform = 'rotate(' + (i ? 5 : -6) + 'deg)'; });
        });
    })();

    /* ---------- confetti ---------- */
    function confetti() {
        if (reduce) return;
        var c = document.getElementById('confetti');
        var ctx = c.getContext('2d');
        var W = c.width = window.innerWidth, H = c.height = window.innerHeight;
        var colors = ['#5ef0a6', '#ff7a3d', '#f2fff7', '#2ecc71', '#ffd166'];
        var parts = [];
        for (var i = 0; i < 140; i++) {
            parts.push({
                x: W / 2 + (Math.random() - .5) * 200, y: H * .55,
                vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4,
                s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
                c: colors[(Math.random() * colors.length) | 0]
            });
        }
        var t0 = performance.now();
        (function tick(now) {
            ctx.clearRect(0, 0, W, H);
            parts.forEach(function (p) {
                p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
                ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
                ctx.restore();
            });
            if (now - t0 < 3200) requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
        })(t0);
    }

    /* ---------- formular ---------- */
    var tpl = document.getElementById('tpl-form');
    var mounts = document.querySelectorAll('[data-form-mount]');
    var submitted = false;

    function normalizePhone(v) {
        var s = (v || '').replace(/[^\d+]/g, '');
        if (!s) return '';
        if (s.indexOf('00') === 0) s = '+' + s.slice(2);
        if (/^07\d{8}$/.test(s)) s = '+4' + s;
        else if (/^40\d{9}$/.test(s)) s = '+' + s;
        var d = s.replace(/\D/g, '');
        return (d.length >= 8 && d.length <= 15) ? s : null;
    }

    function showDone(form, emailed) {
        var wrap = document.createElement('div');
        wrap.className = 'wl done';
        var url = 'https://www.green-go.ro/lansare/';
        var text = 'Se lansează GreenGO în Greenfield: mâncare din restaurantele cartierului, la ușă în ~20 de minute. Înscrie-te aici: ' + url;
        wrap.innerHTML =
            '<div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
            '<h3>Ești pe listă.</h3>' +
            '<p>' + (emailed ? 'Ți-am trimis un email de confirmare. Dacă nu îl vezi, verifică și Spam sau Promoții.' : 'Îți scriem în ziua lansării.') + '</p>' +
            '<div class="share"><a class="wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(text) + '">Trimite vecinilor pe WhatsApp</a>' +
            '<button type="button" data-copy>Copiază linkul</button></div>';
        form.replaceWith(wrap);
        wrap.querySelector('[data-copy]').addEventListener('click', function (e) {
            var b = e.currentTarget;
            (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Copiat'; }, function () { b.textContent = url; });
        });
    }
    var form; // referință folosită în showDone

    mounts.forEach(function (mount, idx) {
        var f = tpl.content.firstElementChild.cloneNode(true);
        f.querySelectorAll('.field').forEach(function (fld, i) {
            var id = 'wl' + idx + '-' + i;
            fld.querySelector('label').setAttribute('for', id);
            fld.querySelector('input').id = id;
        });
        mount.appendChild(f);

        f.addEventListener('submit', function (e) {
            e.preventDefault();
            form = f;
            var msg = f.querySelector('.msg');
            var email = f.elements.email, phone = f.elements.phone, consent = f.elements.consent, btn = f.querySelector('.go');
            email.removeAttribute('aria-invalid'); phone.removeAttribute('aria-invalid'); msg.textContent = '';

            var ev = email.value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ev)) { email.setAttribute('aria-invalid', 'true'); msg.textContent = 'Scrie un email valid, de exemplu nume@email.ro.'; email.focus(); return; }
            var pv = normalizePhone(phone.value);
            if (pv === null) { phone.setAttribute('aria-invalid', 'true'); msg.textContent = 'Telefonul nu pare corect. Poți să-l lași gol sau să scrii, de exemplu, 0712 345 678.'; phone.focus(); return; }
            if (!consent.checked) { msg.textContent = 'Bifează acordul ca să te putem anunța la lansare.'; consent.focus(); return; }

            // anti-bot: câmp ascuns completat sau trimitere sub 2 secunde
            if (f.elements.website.value || Date.now() - pageLoadedAt < 2000) { submitted = true; showDone(f); return; }

            btn.disabled = true; var label = btn.textContent; btn.textContent = 'Se trimite...';
            fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: ev, phone: pv || '', consent: true, source: location.search.slice(1, 200) })
            }).then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; });
            }).then(function (res) {
                if (!res.ok) throw new Error(res.j && res.j.error || 'x');
                submitted = true;
                try { window.dispatchEvent(new CustomEvent('greengo:lead')); } catch (e2) {}
                showDone(f, !!res.j.emailed); confetti();
                // celelalte formulare devin inutile după înscriere
                document.querySelectorAll('.wl:not(.done)').forEach(function (o) { if (o !== f) { form = o; showDone(o, !!res.j.emailed); } });
            }).catch(function (err) {
                btn.disabled = false; btn.textContent = label;
                msg.textContent = err && err.message === 'email' ? 'Emailul nu pare valid. Verifică-l și încearcă din nou.' : 'Nu am putut salva înscrierea. Încearcă din nou în câteva secunde.';
            });
        });
    });

    document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-open-consent]');
        if (t && window.GreenGoConsent) { e.preventDefault(); window.GreenGoConsent.open(); }
    });
})();
