/**
 * Cloudflare Worker entry point.
 *
 * 1) Serves static assets from the repo root (via the ASSETS binding) and
 *    replaces every occurrence of the production backend origin with the
 *    environment-specific APP_BASE_URL before returning HTML or JS responses.
 *
 *    Production  → APP_BASE_URL = https://app.green-go.ro
 *    Staging     → APP_BASE_URL = https://delivery-staging.green-go.ro
 *
 * 2) Waitlist for the launch teaser page (/lansare):
 *    POST /api/waitlist              – saves email (+ optional phone) in D1 and sends an auto-reply
 *    GET  /api/waitlist/export?key=  – CSV export, protected by the EXPORT_KEY secret
 *
 *    Needs (all optional – without them the page keeps working, the form just answers 503):
 *      D1 binding        DB
 *      secret            EXPORT_KEY      (CSV export)
 *      secret            RESEND_API_KEY  (auto-reply via Resend)
 *      var               MAIL_FROM       e.g. "GreenGO <salut@green-go.ro>"
 *      var               MAIL_REPLY_TO   e.g. "info@green-go.ro"
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanPhone(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return raw.slice(0, 20);
}

async function ensureTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS waitlist (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         email TEXT NOT NULL UNIQUE,
         phone TEXT,
         consent_at TEXT NOT NULL,
         source TEXT,
         country TEXT,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`
    )
    .run();
}

function welcomeEmail() {
  const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#06231a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06231a;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b3a2b;border-radius:18px;overflow:hidden;">
<tr><td style="padding:32px 32px 8px;font-size:28px;font-weight:800;color:#f2fff7;">Green<span style="color:#5ef0a6;">GO</span></td></tr>
<tr><td style="padding:8px 32px 0;font-size:30px;line-height:1.15;font-weight:800;color:#f2fff7;">Ești pe listă. Mulțumim!</td></tr>
<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6;color:#cfe8da;">Îți scriem imediat ce GreenGO se lansează în Greenfield: mâncare din restaurantele cartierului, la ușa ta în aproximativ 20 de minute.</td></tr>
<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6;color:#cfe8da;">Până atunci, spune-le și vecinilor, ca să comandăm toți din același cartier.</td></tr>
<tr><td style="padding:24px 32px 8px;"><a href="https://www.green-go.ro/lansare/" style="display:inline-block;background:#5ef0a6;color:#04261b;font-weight:800;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:16px;">Trimite linkul vecinilor</a></td></tr>
<tr><td style="padding:24px 32px 32px;font-size:12px;line-height:1.5;color:#86ac98;">Ai primit acest mesaj pentru că te-ai înscris pe lista de lansare GreenGO. Dacă nu ai fost tu sau nu mai vrei să fii anunțat, răspunde la acest email și te ștergem din listă.</td></tr>
</table></td></tr></table></body></html>`;
  const text =
    'Ești pe listă. Mulțumim!\n\n' +
    'Îți scriem imediat ce GreenGO se lansează în Greenfield: mâncare din restaurantele cartierului, la ușa ta în aproximativ 20 de minute.\n\n' +
    'Poți trimite linkul și vecinilor: https://www.green-go.ro/lansare/\n\n' +
    'Dacă nu ai fost tu sau nu mai vrei să fii anunțat, răspunde la acest email și te ștergem din listă.';
  return { subject: 'Ești pe lista GreenGO', html, text };
}

async function sendWelcome(env, to) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  const { subject, html, text } = welcomeEmail();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
    }),
  });
  return res.ok;
}

async function handleSignup(request, env, ctx) {
  if (!env.DB) return json({ ok: false, error: 'unavailable' }, 503);

  // Accept only same-origin browser requests.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: 'origin' }, 403);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const email = String(data.email || '').trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'email' }, 400);
  const phone = cleanPhone(data.phone);
  if (phone === null) return json({ ok: false, error: 'phone' }, 400);
  if (data.consent !== true) return json({ ok: false, error: 'consent' }, 400);

  const source = String(data.source || '').slice(0, 200);
  const country = request.cf && request.cf.country ? String(request.cf.country) : '';

  await ensureTable(env.DB);
  const result = await env.DB
    .prepare('INSERT OR IGNORE INTO waitlist (email, phone, consent_at, source, country) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(email, phone || null, new Date().toISOString(), source, country)
    .run();

  const inserted = (result.meta && result.meta.changes) > 0;
  let emailed = false;
  if (inserted && env.RESEND_API_KEY && env.MAIL_FROM) {
    // Reply is sent in the background; the visitor does not wait for it.
    ctx.waitUntil(sendWelcome(env, email).catch(() => false));
    emailed = true;
  }
  return json({ ok: true, emailed });
}

function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^\+?\d[\d ]*$/.test(s))) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

async function handleExport(request, env) {
  if (!env.DB || !env.EXPORT_KEY) return new Response('Not found', { status: 404 });
  const key = new URL(request.url).searchParams.get('key') || '';
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(key)),
    crypto.subtle.digest('SHA-256', enc.encode(env.EXPORT_KEY)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  if (diff !== 0) return new Response('Not found', { status: 404 });

  await ensureTable(env.DB);
  const { results } = await env.DB
    .prepare('SELECT email, phone, created_at, consent_at, source, country FROM waitlist ORDER BY id')
    .all();
  const lines = ['email,telefon,data_inscrierii,data_acord,sursa,tara'];
  for (const r of results) {
    lines.push([r.email, r.phone, r.created_at, r.consent_at, r.source, r.country].map(csvCell).join(','));
  }
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="greengo-lista-lansare.csv"',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/waitlist') {
      if (request.method === 'POST') return handleSignup(request, env, ctx);
      return json({ ok: false, error: 'method' }, 405);
    }
    if (url.pathname === '/api/waitlist/export' && request.method === 'GET') {
      return handleExport(request, env);
    }

    const response = await env.ASSETS.fetch(request);

    const contentType = response.headers.get('content-type') ?? '';
    const needsTransform =
      contentType.includes('text/html') || contentType.includes('javascript');

    if (!needsTransform) {
      return response;
    }

    const original = await response.text();
    const transformed = original.replaceAll(
      'https://app.green-go.ro',
      env.APP_BASE_URL
    );

    const headers = new Headers(response.headers);
    // Remove content-length — it may have changed after text replacement
    headers.delete('content-length');
    // Prevent the browser and Cloudflare's edge from caching transformed HTML/JS.
    // Without this, a browser may serve a stale cached page that still contains
    // the original "https://app.green-go.ro" URLs instead of the substituted ones.
    headers.set('cache-control', 'no-store');

    return new Response(transformed, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
