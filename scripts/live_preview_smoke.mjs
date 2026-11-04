#!/usr/bin/env node
/**
 * Live end-to-end smoke test for the isolated Cloudflare Pages preview.
 * This intentionally calls the real Census and NLR endpoints. OpenEI is
 * reported as SKIPPED when its optional server-side key is not configured.
 */
const base = (process.env.PREVIEW_BASE_URL || '').replace(/\/$/, '');
if (!base) throw new Error('PREVIEW_BASE_URL is required.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function jsonRequest(path) {
  const response = await fetch(base + path, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    redirect: 'error',
  });
  let body;
  try { body = await response.json(); }
  catch { throw new Error(path + ' returned non-JSON HTTP ' + response.status); }
  return { response, body };
}

async function waitForCurrentPreview() {
  let last = 'Preview has not returned the target ACS2026 build yet.';
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    try {
      const { response, body } = await jsonRequest('/api/location?search=austin');
      if (response.ok && String(body.source || '').includes('TIGERweb ACS2026')) return body;
      last = 'HTTP ' + response.status + ': ' + String(body.error || body.source || last);
    } catch (error) {
      last = error.message;
    }
    await sleep(10000);
  }
  throw new Error('Preview did not become ready with the ACS2026 Census resolver after 6 minutes: ' + last);
}

const suggestions = await waitForCurrentPreview();
const austin = (suggestions.suggestions || []).find((place) =>
  place.placeName.toLowerCase() === 'austin' && place.stateAbbreviation === 'TX'
);
if (!austin) throw new Error('Live ACS2026 autocomplete did not return Austin, TX.');
console.log('PASS live Census autocomplete: Austin, TX; ' + suggestions.source);

const exact = await jsonRequest('/api/location?city=Austin&state=TX');
if (!exact.response.ok) throw new Error('Exact Census location lookup failed: HTTP ' + exact.response.status + ' ' + JSON.stringify(exact.body));
const place = (exact.body.places || []).find((item) => item.stateAbbreviation === 'TX' && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
if (!place) throw new Error('Exact Census lookup returned no usable Austin, TX coordinates.');
console.log('PASS live Census exact lookup: ' + place.placeName + ', TX (' + place.latitude + ', ' + place.longitude + ').');

const pvQuery = new URLSearchParams({
  lat: String(place.latitude),
  lon: String(place.longitude),
  state: 'TX',
  capacity: '1',
  tilt: '20',
  azimuth: '180',
  losses: '14',
});
const pv = await jsonRequest('/api/pvwatts?' + pvQuery.toString());
if (!pv.response.ok) throw new Error('Live PVWatts failed: HTTP ' + pv.response.status + ' ' + JSON.stringify(pv.body));
const annual = Number(pv.body.outputs?.annualAcKwh);
const monthly = pv.body.outputs?.monthlyAcKwh;
if (!(annual > 0) || !Array.isArray(monthly) || monthly.length !== 12 || monthly.some((value) => !Number.isFinite(Number(value)))) {
  throw new Error('Live PVWatts response lacks positive annual output and 12 valid monthly values.');
}
if (JSON.stringify(pv.body).toLowerCase().includes('api_key')) throw new Error('PVWatts response unexpectedly contains an API-key field.');
console.log('PASS live NLR PVWatts V8: ' + Math.round(annual).toLocaleString('en-US') + ' kWh/year for 1 kW DC. Station: ' + (pv.body.stationInfo?.location || 'not supplied') + '.');

const tariffQuery = new URLSearchParams({
  lat: String(place.latitude),
  lon: String(place.longitude),
  state: 'TX',
});
const tariff = await jsonRequest('/api/tariffs?' + tariffQuery.toString());
if (tariff.response.status === 503 && /OpenEI API key|OPENEI_API_KEY|not configured/i.test(String(tariff.body.error || ''))) {
  console.log('SKIP live OpenEI: site owner has not configured OPENEI_API_KEY in Cloudflare Preview.');
} else if (tariff.response.ok && Array.isArray(tariff.body.rates)) {
  console.log('PASS live OpenEI: ' + tariff.body.rates.length + ' nearby candidate records. These are not confirmed household tariffs.');
} else {
  throw new Error('Live OpenEI returned unexpected result: HTTP ' + tariff.response.status + ' ' + JSON.stringify(tariff.body));
}

console.log('LIVE PREVIEW SMOKE TEST COMPLETED.');
