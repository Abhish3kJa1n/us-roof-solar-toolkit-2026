const NONCE_PATTERN = /^[A-Za-z0-9+/]{22}==$/;
function assertNonce(nonce) {
  if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) throw new TypeError("CSP nonce must be a 128-bit Base64 value.");
}
export function createNonce(cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== "function") throw new TypeError("A cryptographically secure random-number provider is required.");
  const bytes = new Uint8Array(16);
  cryptoProvider.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function buildStrictCspReportOnly(nonce) {
  assertNonce(nonce);
  return [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self' data:", "connect-src 'self'", "upgrade-insecure-requests",
  ].join("; ");
}
export function buildStrictCsp(nonce) {
  assertNonce(nonce);
  // Google's documented AdSense script-src shape uses a fresh nonce and strict-dynamic.
  return [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`,
    "style-src 'self' 'unsafe-inline' https:", "img-src 'self' data: blob: https:", "font-src 'self' data: https:",
    "connect-src 'self' https:", "frame-src https: data: blob:", "child-src https: data: blob:",
    "media-src 'self' https: data: blob:", "worker-src 'self' blob:", "manifest-src 'self'", "upgrade-insecure-requests",
  ].join("; ");
}
