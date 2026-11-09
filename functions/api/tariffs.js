/** Cloudflare Pages Function: discovery of nearby OpenEI residential rate records only. */
import { reserveApiQuota } from '../_shared/quota.js';
import { verifyLocationToken } from '../_shared/location-token.js';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    // Authorization is carried in a signed Census proof header; never cache the
    // whole endpoint response by URL because CDN keys do not vary by that header.
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

export async function onRequestGet({ request, env }) {
  const apiKey = env?.OPENEI_API_KEY;
  if (!apiKey) {
    return json({ error: 'Nearby utility-rate records are temporarily unavailable. Please try again later.' }, 503);
  }
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const state = (params.get('state') || '').trim().toUpperCase();
  const westernUsEnvelope = Number.isFinite(lat) && lat >= -15 && lat <= 72 && Number.isFinite(lon) && lon >= -180 && lon <= -60;
  const guamEnvelope = state === 'GU' && Number.isFinite(lat) && lat >= 13 && lat <= 14.5 && Number.isFinite(lon) && lon >= 144 && lon <= 145.5;
  const marianaEnvelope = state === 'MP' && Number.isFinite(lat) && lat >= 14 && lat <= 21.5 && Number.isFinite(lon) && lon >= 144 && lon <= 147;
  if (!westernUsEnvelope && !guamEnvelope && !marianaEnvelope) {
    return json({ error: 'Valid coordinates within a supported U.S. state or territory are required. Guam and Northern Mariana Islands require the matching selected Census location.' }, 400);
  }
  const locationProof = await verifyLocationToken(request.headers.get('X-Location-Proof'), env, { latitude: lat, longitude: lon, state });
  if (!locationProof) {
    return json({ error: 'Select and verify a city/state through the Census location search before requesting tariff candidates. Arbitrary coordinates are not accepted.' }, 400);
  }

  // OpenEI's reviewed public API documentation does not state a numeric
  // request quota. Until provider-specific limits are confirmed, use a
  // conservative site-side cap: 60 per 15 minutes and 5,000 per UTC day.
  let quota;
  try {
    quota = await reserveApiQuota(env?.API_QUOTA_DB, 'openei', 60, 5000);
  } catch {
    return json({ error: 'Nearby utility-rate records are temporarily unavailable. Please try again later.' }, 503);
  }
  if (!quota) {
    return json({ error: 'Nearby utility-rate records are temporarily unavailable. Please try again later.' }, 429);
  }

  const upstreamUrl = new URL('https://api.openei.org/utility_rates');
  const query = {
    version: 'latest', format: 'json', api_key: apiKey,
    sector: 'Residential', lat: String(lat), lon: String(lon),
    radius: '10', co_limit: '10', limit: '50', detail: 'minimal',
  };
  Object.entries(query).forEach(([key, value]) => upstreamUrl.searchParams.set(key, value));
  let upstream;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
  } catch {
    return json({ error: 'OpenEI could not be reached. Please retry later.' }, 502);
  }
  let data;
  try { data = await upstream.json(); }
  catch { return json({ error: 'OpenEI returned an unreadable response.' }, 502); }
  if (!upstream.ok || data?.errors || data?.error) {
    return json({ error: String(data?.error || data?.errors || `OpenEI returned HTTP ${upstream.status}`).slice(0, 400) }, 502);
  }
  const items = Array.isArray(data.items) ? data.items : [];
  const formatDate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const raw = String(value).trim();
    // URDB documents effective dates as Unix timestamps; tolerate YYYYMMDD
    // representations too, as well as already formatted ISO dates.
    if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    if (/^\d{10}$/.test(raw)) {
      const date = new Date(Number(raw) * 1000);
      return Number.isNaN(date.getTime()) ? raw.slice(0, 40) : date.toISOString().slice(0, 10);
    }
    if (/^\d{13}$/.test(raw)) {
      const date = new Date(Number(raw));
      return Number.isNaN(date.getTime()) ? raw.slice(0, 40) : date.toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return raw.slice(0, 40);
  };
  const rates = items.slice(0, 50).map((item) => {
    const label = typeof item.label === 'string' ? item.label : '';
    let uri = '';
    if (typeof item.uri === 'string') {
      try { const parsed = new URL(item.uri); if (parsed.protocol === 'https:' && parsed.hostname === 'apps.openei.org') uri = parsed.toString(); } catch { /* discard malformed source URL */ }
    }
    return {
      label,
      utility: typeof item.utility === 'string' ? item.utility.slice(0, 160) : '',
      name: typeof item.name === 'string' ? item.name.slice(0, 200) : '',
      sector: typeof item.sector === 'string' ? item.sector : 'Residential (API query filter)',
      approved: item.approved === true,
      isDefault: item.is_default === true,
      startDate: item.startdate === undefined || item.startdate === null ? null : formatDate(item.startdate),
      endDate: item.enddate === undefined || item.enddate === null ? null : formatDate(item.enddate),
      url: uri,
    };
  }).filter((item) => item.label);

  return json({
    rates,
    returned: rates.length,
    source: 'OpenEI Utility Rate Database (URDB)',
    searchRadiusMiles: 10,
    limitation: 'These are nearby database records, not confirmation that a record applies to this address or utility account. Census representative-place coordinates and utility service territories are approximate. Do not use a candidate in a savings estimate until its utility, rate name, effective dates, tariff document, customer class and export rules match the homeowner’s current bill.',
  });
}
