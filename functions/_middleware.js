import { buildStrictCspReportOnly, createNonce } from "./_shared/csp.mjs";

const CURRENT_ENFORCED_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

/**
 * Preview-only CSP probe. scripts/prepare_deploy.sh routes HTML through this
 * middleware on non-main builds; Production retains static HTML delivery.
 *
 * The enforced policy is unchanged. The nonce-based Google-compatible policy
 * is report-only until browser testing is complete. No AdSense loader or ad
 * placements are inserted by this middleware.
 */
export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;

  // The existing API Functions keep their own behavior and response handling.
  if (pathname.startsWith("/api/")) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!/^text\/html(?:\s*;|$)/i.test(contentType) || response.status < 200 || response.status >= 300) {
    return response;
  }

  const nonce = createNonce();
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  // Pages _headers rules do not apply to Function responses, so restate the
  // current enforced policy and Preview crawler protection here.
  headers.set("Content-Security-Policy", CURRENT_ENFORCED_CSP);
  headers.set("Content-Security-Policy-Report-Only", buildStrictCspReportOnly(nonce));
  headers.set("X-Robots-Tag", "noindex, follow");

  // A nonce must not be reused from a cached HTML response. Preview-only route
  // instrumentation is deliberately non-cacheable; static assets are untouched.
  headers.set("Cache-Control", "private, no-store");
  headers.delete("Content-Length");
  headers.delete("ETag");

  const nonceResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  return new HTMLRewriter()
    .on("script", {
      element(element) {
        element.setAttribute("nonce", nonce);
      },
    })
    .transform(nonceResponse);
}
