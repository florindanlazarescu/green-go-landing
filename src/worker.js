/**
 * Cloudflare Worker entry point.
 *
 * Serves static assets from the repo root (via the ASSETS binding) and
 * replaces every occurrence of the production backend origin with the
 * environment-specific APP_BASE_URL before returning HTML or JS responses.
 *
 * Production  → APP_BASE_URL = https://app.green-go.ro
 * Staging     → APP_BASE_URL = https://delivery-staging.green-go.ro
 */
export default {
  async fetch(request, env) {
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

