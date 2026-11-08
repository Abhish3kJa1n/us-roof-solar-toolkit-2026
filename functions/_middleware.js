import { buildStrictCsp, buildStrictCspReportOnly, createNonce } from "./_shared/csp.mjs";

const PUBLISHER_ID = "ca-pub-6193507831935325";
const PRODUCTION_HOSTS = new Set([
  "getroofsolarcalculator.online",
  "www.getroofsolarcalculator.online",
]);
const CURRENT_ENFORCED_CSP = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  "form-action 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:", "font-src 'self' data:", "connect-src 'self'", "upgrade-insecure-requests",
].join("; ");
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function isGuideDocumentPath(pathname) {
  const normalized = pathname.endsWith(".html") ? pathname.slice(0, -5) : pathname;
  if (!normalized.startsWith("/guides/")) return false;
  const slug = normalized.slice("/guides/".length);
  return slug.length > 0 && !slug.includes("/");
}
function isEiaReferencePath(pathname) {
  return pathname === "/electricity-prices-by-state" || pathname === "/electricity-prices-by-state.html";
}
function isAdEligiblePath(pathname) {
  return isGuideDocumentPath(pathname) || isEiaReferencePath(pathname);
}
function canLoadAdSense(context, url, response) {
  if (!response.ok || !PRODUCTION_HOSTS.has(url.hostname)) return false;
  if (String(context.env?.ADSENSE_ENABLED || "").toLowerCase() !== "true") return false;
  return isAdEligiblePath(url.pathname);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  // Preserve the existing API Functions and all non-GET request behavior.
  if (url.pathname.startsWith("/api/") || request.method !== "GET") return context.next();

  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!/^text\/html(?:\s*;|$)/i.test(contentType) || response.status < 200 || response.status >= 300) return response;

  const nonce = createNonce();
  const eligible = isAdEligiblePath(url.pathname);
  const isProductionHost = PRODUCTION_HOSTS.has(url.hostname);
  const loadAdSense = eligible && canLoadAdSense(context, url, response);

  const transformed = new HTMLRewriter()
    .on("script", { element(element) { element.setAttribute("nonce", nonce); } })
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
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set("Content-Security-Policy", eligible ? buildStrictCsp(nonce) : CURRENT_ENFORCED_CSP);
  headers.set("Content-Security-Policy-Report-Only", buildStrictCspReportOnly(nonce));
  if (isProductionHost) headers.delete("X-Robots-Tag");
  else headers.set("X-Robots-Tag", "noindex, follow");

  // Every nonce-bearing HTML response is uncacheable to prevent nonce reuse.
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.delete("Content-Length");
  headers.delete("ETag");
  return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers });
}
