/**
 * Short-lived proof that a coordinate was returned by this site's exact
 * US Census city/state verification route. Prevents public provider proxies
 * from accepting arbitrary caller-supplied coordinates.
 *
 * The HMAC uses a domain-separated key derived from an existing server-side
 * provider secret; no additional secret or browser-visible key is required.
 */
const encoder = new TextEncoder();
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const TOKEN_SOURCE = 'us-census-tigerweb-acs2026';

function signingSecret(env) {
  const value = env?.LOCATION_TOKEN_SECRET || env?.PVWATTS_API_KEY || env?.OPENEI_API_KEY;
  return typeof value === 'string' && value.length >= 16 ? value : null;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(env) {
  const secret = signingSecret(env);
  if (!secret || !globalThis.crypto?.subtle) return null;
  const material = encoder.encode('roof-solar-toolkit:location-token:v1:' + secret);
  return globalThis.crypto.subtle.importKey(
    'raw',
    material,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createLocationToken(place, env, now = Date.now()) {
  const key = await signingKey(env);
  if (!key || !place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) return null;
  const state = String(place.stateAbbreviation || '').toUpperCase();
  const geoid = String(place.geoid || '');
  const city = String(place.placeName || '').trim();
  if (!/^[A-Z]{2}$/.test(state) || !/^\d{7}$/.test(geoid) || !city) return null;

  const issuedAt = Math.floor(now / 1000);
  const payload = {
    v: 1,
    source: TOKEN_SOURCE,
    city,
    state,
    geoid,
    lat: Number(place.latitude),
    lon: Number(place.longitude),
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS,
  };
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payloadPart)));
  return payloadPart + '.' + base64UrlEncode(signature);
}

export async function verifyLocationToken(token, env, expected, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payloadBytes = base64UrlDecode(parts[0]);
  const signature = base64UrlDecode(parts[1]);
  if (!payloadBytes || !signature || signature.length !== 32) return null;

  const key = await signingKey(env);
  if (!key) return null;
  let validSignature = false;
  try {
    validSignature = await globalThis.crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[0]));
  } catch {
    return null;
  }
  if (!validSignature) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  const nowSeconds = Math.floor(now / 1000);
  if (payload?.v !== 1 || payload.source !== TOKEN_SOURCE) return null;
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
  if (payload.iat > nowSeconds + 30 || payload.exp <= nowSeconds) return null;
  if (payload.exp <= payload.iat || payload.exp - payload.iat > TOKEN_TTL_SECONDS) return null;
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) return null;
  if (!/^[A-Z]{2}$/.test(String(payload.state || '')) || !/^\d{7}$/.test(String(payload.geoid || ''))) return null;
  if (!String(payload.city || '').trim()) return null;

  // Exact number equality is intentional: callers must submit the exact
  // coordinates returned by Census, not a rounded or caller-shifted location.
  if (!expected
    || payload.lat !== expected.latitude
    || payload.lon !== expected.longitude
    || payload.state !== expected.state) return null;
  return payload;
}
