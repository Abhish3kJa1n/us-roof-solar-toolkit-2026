/**
 * Per-response CSP nonce for the initial ad-eligible editorial HTML documents.
 *
 * This middleware is deliberately scoped to the guide and EIA reference routes
 * where ads may eventually be considered. Other pages and static assets stay
 * static and do not consume additional Pages Function invocations.
 * HTML is not cacheable because every response must carry a fresh nonce.
 *
 * AdSense is off by default. It can only be enabled on the canonical custom
 * domain after approval and the publisher's privacy/consent controls are ready.
 * To protect calculator UX, the initial loader scope is editorial guides and
 * the source-backed electricity-prices page; the homepage and calculators are
 * intentionally excluded until separately designed ad units are reviewed.
 */

const PUBLISHER_ID = "ca-pub-6193507831935325";
const PRODUCTION_HOSTS = new Set([
  "getroofsolarcalculator.online",
  "www.getroofsolarcalculator.online",
]);
function isGuideDocumentPath(pathname) {
  const normalized = pathname.endsWith(".html") ? pathname.slice(0, -5) : pathname;
  if (!normalized.startsWith("/guides/")) return false;
  const slug = normalized.slice("/guides/".length);
  return slug.length > 0 && !slug.includes("/");
}

function isEiaReferencePath(pathname) {
  return pathname === "/electricity-prices-by-state" ||
    pathname === "/electricity-prices-by-state.html";
}

function isAdEligiblePath(pathname) {
  return isGuideDocumentPath(pathname) || isEiaReferencePath(pathname);
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildContentSecurityPolicy(nonce) {
  // Google documents this nonce + strict-dynamic shape for AdSense CSP.
  // Resource directives stay explicit; no wildcard host allowlist is maintained.
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-src https: data: blob:",
    "child-src https: data: blob:",
    "media-src 'self' https: data: blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function isHtmlPath(pathname) {
  return isAdEligiblePath(pathname);
}

function canLoadAdSense(context, url, response) {
  if (!response.ok || !PRODUCTION_HOSTS.has(url.hostname)) return false;
  if (String(context.env?.ADSENSE_ENABLED || "").toLowerCase() !== "true") return false;
  if (url.pathname === "/404.html" || url.pathname === "/privacy.html" || url.pathname === "/terms.html") {
    return false;
  }
  return isAdEligiblePath(url.pathname);
}

function addSecurityHeaders(headers, nonce, isProductionHost) {
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

  // Preview and pages.dev deployment URLs remain noindex. The two configured
  // custom-domain hosts are the only indexable hosts.
  if (isProductionHost) {
    headers.delete("X-Robots-Tag");
  } else {
    headers.set("X-Robots-Tag", "noindex, follow");
  }

  // A nonce must not be reused from a shared or browser cache.
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.delete("Content-Length");
  headers.delete("ETag");
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // _routes.json sends only HTML documents and existing /api/* endpoints here.
  // Leave APIs and non-HTML methods untouched.
  if (request.method !== "GET" || !isHtmlPath(url.pathname)) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("text/html") || response.status < 200 || response.status >= 300) {
    return response;
  }

  const nonce = createNonce();
  const isProductionHost = PRODUCTION_HOSTS.has(url.hostname);
  const loadAdSense = canLoadAdSense(context, url, response);

  const transformed = new HTMLRewriter()
    .on("script", {
      element(element) {
        element.setAttribute("nonce", nonce);
      },
    })
    .on("head", {
      element(element) {
        if (!loadAdSense) return;
        element.append(
          `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}" crossorigin="anonymous" nonce="${nonce}"></script>`,
          { html: true },
        );
      },
    })
    .transform(response);

  const headers = new Headers(transformed.headers);
  addSecurityHeaders(headers, nonce, isProductionHost);

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}
