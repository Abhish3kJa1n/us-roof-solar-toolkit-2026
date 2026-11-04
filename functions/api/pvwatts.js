/** Cloudflare Pages Function: server-side proxy for NLR PVWatts V8. */
import { reserveApiQuota } from '../_shared/quota.js';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=300, s-maxage=2592000' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

const numberParam = (params, name, min, max) => {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return { error: `${name} is required.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return { error: `${name} must be between ${min} and ${max}.` };
  return { value };
};

const isSupportedUsCoordinate = (lat, lon, state) => {
  // Western longitudes cover the contiguous states, Alaska, Hawaii, Puerto Rico,
  // U.S. Virgin Islands and American Samoa. Guam and the Northern Mariana Islands
  // use positive longitudes and are admitted only inside their rough territory
  // envelopes, with the selected Census state/territory code present.
  const westernUsEnvelope = lat >= -15 && lat <= 72 && lon >= -180 && lon <= -60;
  const guamEnvelope = state === 'GU' && lat >= 13 && lat <= 14.5 && lon >= 144 && lon <= 145.5;
  const marianaEnvelope = state === 'MP' && lat >= 14 && lat <= 21.5 && lon >= 144 && lon <= 147;
  return westernUsEnvelope || guamEnvelope || marianaEnvelope;
};

// Keep the NLR key below its published 1,000-request rolling-hour ceiling.
// 180 per fixed 15-minute bucket means at most 900 across any rolling hour.
const WINDOW_LIMIT = 180;
const DAILY_LIMIT = 15000;

export async function onRequestGet({ request, env }) {
  const apiKey = env?.PVWATTS_API_KEY;
  if (!apiKey) {
    return json({ error: 'Solar modeling is not configured yet. The site owner must add a free NLR PVWatts API key as a server-side Pages secret.' }, 503);
  }

  const params = new URL(request.url).searchParams;
  const specs = {
    // The public estimator only supports broad US/territory coordinates returned
    // by the Census city/place resolver. Prevent unrelated direct API calls from
    // consuming the owner's NLR key.
    lat: [-90, 90], lon: [-180, 180], capacity: [0.05, 100], tilt: [0, 90], azimuth: [0, 359.99], losses: [0, 99],
  };
  const values = {};
  for (const [name, [min, max]] of Object.entries(specs)) {
    const parsed = numberParam(params, name, min, max);
    if (parsed.error) return json({ error: parsed.error }, 400);
    values[name] = parsed.value;
  }
  const state = (params.get('state') || '').trim().toUpperCase();
  if (!isSupportedUsCoordinate(values.lat, values.lon, state)) {
    return json({ error: 'Coordinates must be within a supported U.S. state or territory location. For Guam or the Northern Mariana Islands, select the corresponding Census place first.' }, 400);
  }

  // Fail closed: never send an upstream request when the shared quota guard is
  // not configured or cannot be reached. The D1 update is atomic across requests.
  let quota;
  try {
    quota = await reserveApiQuota(env?.API_QUOTA_DB, 'pvwatts', WINDOW_LIMIT, DAILY_LIMIT);
  } catch {
    return json({ error: 'Solar modeling is temporarily paused because its global request-quota guard is unavailable. Please try again later.' }, 503);
  }
  if (!quota) {
    return json({ error: 'The solar model has reached its shared request limit. Please retry later.' }, 429);
  }

  const upstreamUrl = new URL('https://developer.nlr.gov/api/pvwatts/v8.json');
  const upstreamParams = {
    api_key: apiKey,
    format: 'json',
    system_capacity: String(values.capacity),
    module_type: '0',                 // Standard module; explicit, editable model choice can be added later.
    losses: String(values.losses),
    array_type: '1',                  // Fixed, roof-mounted array.
    tilt: String(values.tilt),
    azimuth: String(values.azimuth),
    lat: String(values.lat),
    lon: String(values.lon),
    dataset: 'nsrdb',
    // Require a climate station within 100 miles; do not silently use a distant station.
    radius: '100',
    timeframe: 'monthly',
    dc_ac_ratio: '1.2',
  };
  Object.entries(upstreamParams).forEach(([key, value]) => upstreamUrl.searchParams.set(key, value));

  let upstream;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 2592000, cacheEverything: true },
    });
  } catch {
    return json({ error: 'NLR PVWatts could not be reached. Please retry later.' }, 502);
  }

  let data;
  try { data = await upstream.json(); }
  catch { return json({ error: 'NLR PVWatts returned an unreadable response.' }, 502); }
  if (upstream.status === 429) {
    return json({ error: 'The solar model has reached its upstream request limit. Please retry later.' }, 429);
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return json({ error: 'The server-side PVWatts key was rejected. The site owner must check its NLR API key configuration.' }, 503);
  }
  if (!upstream.ok || (Array.isArray(data.errors) && data.errors.length)) {
    const explanation = Array.isArray(data.errors) && data.errors.length
      ? data.errors.map((item) => String(item).slice(0, 240)).join(' ')
      : `NLR PVWatts returned HTTP ${upstream.status}.`;
    return json({ error: explanation }, upstream.status === 422 ? 422 : 502);
  }

  const outputs = data.outputs || {};
  const annual = Number(outputs.ac_annual);
  const monthly = Array.isArray(outputs.ac_monthly) ? outputs.ac_monthly.map(Number) : [];
  if (!Number.isFinite(annual) || annual <= 0 || monthly.length !== 12 || monthly.some((n) => !Number.isFinite(n) || n < 0)) {
    return json({ error: 'The PVWatts response did not contain valid annual and 12-month AC production values.' }, 502);
  }

  const station = data.station_info || {};
  const safeStation = {};
  for (const key of ['lat', 'lon', 'elev', 'tz', 'location', 'city', 'state', 'distance', 'solar_resource_file', 'weather_data_source']) {
    if (station[key] !== undefined && station[key] !== null) safeStation[key] = station[key];
  }

  return json({
    model: 'NLR PVWatts V8',
    climateDataset: 'NSRDB typical meteorological year (dataset availability varies by location)',
    inputs: {
      latitude: values.lat,
      longitude: values.lon,
      systemCapacityKwDc: values.capacity,
      moduleType: 'Standard',
      arrayType: 'Fixed roof-mounted',
      tiltDegrees: values.tilt,
      azimuthDegrees: values.azimuth,
      systemLossesPercent: values.losses,
      dcAcRatio: 1.2,
    },
    outputs: {
      annualAcKwh: annual,
      monthlyAcKwh: monthly,
      annualSolarRadiationKwhM2Day: Number.isFinite(Number(outputs.solrad_annual)) ? Number(outputs.solrad_annual) : null,
      // PVWatts V8 reports this field in percent units (for example, 11.79 means 11.79%).
      capacityFactorPercent: Number.isFinite(Number(outputs.capacity_factor)) && Number(outputs.capacity_factor) >= 0 && Number(outputs.capacity_factor) <= 100
        ? Number(outputs.capacity_factor) : null,
      annualKwhPerKwDc: annual / values.capacity,
    },
    stationInfo: safeStation,
    warnings: Array.isArray(data.warnings) ? data.warnings.map((w) => String(w).slice(0, 240)) : [],
    source: 'National Laboratory of the Rockies (NLR), PVWatts V8 API',
    fetchedAt: new Date().toISOString(),
    limitations: [
      'This is a typical-year model, not a forecast or a measurement of this home.',
      'The Census city/place representative point is approximate and does not locate the roof.',
      'Roof tilt, azimuth and system losses are visitor-entered assumptions.',
      'Tree/building shade, roof obstructions, structural suitability, utility tariff and export rules are not determined by this model.',
    ],
  });
}
