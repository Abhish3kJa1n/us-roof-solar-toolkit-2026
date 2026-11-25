const PROJECT_PREVIEW_SUFFIX = '.roof-solar-toolkit-2026.pages.dev';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function asUrl(value, base) {
  try {
    return new URL(value, base);
  } catch {
    throw new Error('Cloudflare Access helper received an invalid URL: ' + String(value));
  }
}

/**
 * Return Cloudflare service-token headers only for the exact configured
 * Pages Preview origin. Never attach these credentials to Production,
 * other Pages projects, or third-party resources loaded by the page.
 */
export function cloudflareAccessHeadersForUrl(requestUrl, previewBaseUrl = process.env.PREVIEW_BASE_URL) {
  if (!previewBaseUrl) return {};

  const preview = asUrl(previewBaseUrl);
  const target = asUrl(requestUrl, preview);
  if (!preview.hostname.toLowerCase().endsWith(PROJECT_PREVIEW_SUFFIX)) return {};
  if (target.origin !== preview.origin) return {};

  const clientId = (process.env.CF_ACCESS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.CF_ACCESS_CLIENT_SECRET || '').trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error('Cloudflare Access Preview authentication requires both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET GitHub Actions secrets.');
  }
  if (!clientId) return {};

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  };
}

/**
 * Install origin-scoped service-token headers for Playwright. The route is
 * deliberately scoped to the one Preview origin so tokens are not exposed
 * to external scripts, APIs, images, redirects or public Production hosts.
 */
export async function installCloudflareAccess(context, previewBaseUrl = process.env.PREVIEW_BASE_URL) {
  if (!previewBaseUrl) throw new Error('PREVIEW_BASE_URL is required before installing Cloudflare Access headers.');

  await context.route('**/*', async (route) => {
    const request = route.request();
    const safeHeaders = { ...request.headers() };
    delete safeHeaders['cf-access-client-id'];
    delete safeHeaders['cf-access-client-secret'];
    const accessHeaders = cloudflareAccessHeadersForUrl(request.url(), previewBaseUrl);
    return route.continue({
      headers: {
        ...safeHeaders,
        ...accessHeaders,
      },
    });
  });
}

/**
 * Fetch Preview resources while following same-origin canonical redirects only.
 * A cross-origin redirect (including a Cloudflare Access login redirect) is
 * returned without following it, preventing service-token leakage.
 */
export async function fetchPreview(requestUrl, init = {}, previewBaseUrl = process.env.PREVIEW_BASE_URL) {
  if (!previewBaseUrl) throw new Error('PREVIEW_BASE_URL is required for Preview requests.');

  const preview = asUrl(previewBaseUrl);
  let target = asUrl(requestUrl, preview);
  const method = String(init.method || 'GET').toUpperCase();

  for (let redirects = 0; redirects <= 8; redirects += 1) {
    const headers = new Headers(init.headers || {});
    for (const [name, value] of Object.entries(cloudflareAccessHeadersForUrl(target, preview.href))) {
      headers.set(name, value);
    }
    const response = await fetch(target, {
      ...init,
      headers,
      redirect: 'manual',
    });

    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;

    const next = asUrl(location, target);
    if (next.origin !== preview.origin) return response;

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== 'GET' && method !== 'HEAD')) {
      throw new Error('Preview request attempted a same-origin redirect that changes the HTTP method; refusing to replay it automatically.');
    }
    target = next;
  }

  throw new Error('Preview exceeded the maximum of 8 same-origin redirects.');
}

export function isCloudflareAccessChallenge(response) {
  if (!response) return false;
  const status = typeof response.status === 'function' ? response.status() : response.status;
  const responseUrl = typeof response.url === 'function' ? response.url() : response.url;
  const responseHeaders = typeof response.headers === 'function' ? response.headers() : response.headers;
  const location = responseHeaders?.get?.('location')
    || responseHeaders?.location
    || responseHeaders?.Location
    || '';
  const urlText = String(responseUrl || '') + ' ' + String(location);
  return [401, 403].includes(Number(status))
    || /(?:^|[./])cloudflareaccess\.com\b|\/cdn-cgi\/access\/login\b/i.test(urlText);
}

export class CloudflareAccessError extends Error {
  constructor(label, status, credentialHint) {
    super(label + ' is returning a Cloudflare Access challenge or denial (HTTP ' + status + '). ' + credentialHint);
    this.name = 'CloudflareAccessError';
  }
}

export function assertPreviewNotAccessChallenge(response, label = 'Cloudflare Pages Preview') {
  if (!isCloudflareAccessChallenge(response)) return;
  const hasId = Boolean((process.env.CF_ACCESS_CLIENT_ID || '').trim());
  const hasSecret = Boolean((process.env.CF_ACCESS_CLIENT_SECRET || '').trim());
  const credentialHint = hasId && hasSecret
    ? 'The configured service token may be invalid or its Service Auth policy may not cover this hostname.'
    : 'Configure both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET as GitHub Actions secrets.';
  const status = typeof response.status === 'function' ? response.status() : response.status;
  throw new CloudflareAccessError(label, status, credentialHint);
}
