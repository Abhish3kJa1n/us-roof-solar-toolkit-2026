#!/usr/bin/env node
import assert from "node:assert/strict";

const BASE = "https://roof-solar-toolkit-2026.pages.dev";
const city = "Austin";
const state = "TX";

async function getJson(path, headers = {}) {
  const response = await fetch(BASE + path, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache", ...headers },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(path + " returned non-JSON HTTP " + response.status);
  }
  return { response, body };
}

const census = await getJson("/api/location?city=Austin&state=TX");
assert.equal(census.response.status, 200, "Production Census exact lookup must work");
assert.ok(Array.isArray(census.body.places) && census.body.places.length > 0, "Austin, TX must resolve to a Census place");
const place = census.body.places.find((item) =>
  item.stateAbbreviation === state
  && item.placeName.toLowerCase() === city.toLowerCase()
  && Number.isFinite(item.latitude)
  && Number.isFinite(item.longitude)
);
assert.ok(place, "Exact Census lookup must return Austin, TX with coordinates");

if (!place.locationToken || typeof place.locationToken !== "string") {
  console.log("BLOCKED: Production Census returned Austin but no signed location proof.");
  console.log("The Production location-token signing secret or provider-secret fallback is not configured.");
  console.log("PVWatts/OpenEI calls skipped to avoid testing unsigned coordinates.");
  process.exit(2);
}
console.log("PASS: Production Census exact lookup issues a signed Austin, TX location proof.");

const pvParams = new URLSearchParams({
  lat: String(place.latitude),
  lon: String(place.longitude),
  state,
  capacity: "1",
  tilt: "20",
  azimuth: "180",
  losses: "14",
});
const pv = await getJson("/api/pvwatts?" + pvParams.toString(), {
  "X-Location-Proof": place.locationToken,
});
if (pv.response.status === 503 && /PVWatts API key|PVWATTS_API_KEY|not configured/i.test(String(pv.body.error || ""))) {
  console.log("BLOCKED: Production PVWatts provider secret is missing or not accepted.");
  console.log("Production needs a valid server-side PVWATTS_API_KEY.");
  process.exitCode = 2;
} else {
  assert.equal(pv.response.status, 200, "Production PVWatts must succeed: " + String(pv.body.error || ""));
  const annual = Number(pv.body.outputs?.annualAcKwh);
  const monthly = pv.body.outputs?.monthlyAcKwh;
  assert.ok(Number.isFinite(annual) && annual > 0, "PVWatts must return positive annual AC production");
  assert.ok(Array.isArray(monthly) && monthly.length === 12 && monthly.every((n) => Number.isFinite(Number(n)) && Number(n) >= 0), "PVWatts must return 12 non-negative monthly values");
  const distanceMeters = Number(pv.body.stationInfo?.distance);
  if (Number.isFinite(distanceMeters)) {
    const distanceMiles = distanceMeters / 1609.344;
    assert.ok(distanceMeters >= 0 && distanceMiles <= 100, "PVWatts weather station must be within the configured 100-mile radius; returned " + distanceMeters + " meters (" + distanceMiles.toFixed(2) + " miles)");
    console.log("PASS: Production PVWatts V8 returns " + Math.round(annual).toLocaleString("en-US") + " kWh/year for 1 kW DC; station distance " + distanceMeters + " meters (" + distanceMiles.toFixed(2) + " miles).");
  } else {
    console.log("PARTIAL: Production PVWatts returns " + Math.round(annual).toLocaleString("en-US") + " kWh/year, but station distance is not present in the upstream response.");
  }
}

const tariffParams = new URLSearchParams({
  lat: String(place.latitude),
  lon: String(place.longitude),
  state,
});
const tariff = await getJson("/api/tariffs?" + tariffParams.toString(), {
  "X-Location-Proof": place.locationToken,
});
if (tariff.response.status === 503 && /OpenEI API key|OPENEI_API_KEY|not configured/i.test(String(tariff.body.error || ""))) {
  console.log("BLOCKED: Production OpenEI provider secret is missing or not accepted.");
  console.log("Production needs a valid server-side OPENEI_API_KEY.");
  process.exitCode = 2;
} else {
  assert.equal(tariff.response.status, 200, "Production OpenEI must succeed: " + String(tariff.body.error || ""));
  assert.ok(Array.isArray(tariff.body.rates), "OpenEI should return a candidate-rate array");
  console.log("PASS: Production OpenEI returns " + tariff.body.rates.length + " nearby candidate records. These are not confirmed customer tariffs.");
}

if (process.exitCode === 2) {
  console.log("PRODUCTION PROVIDER CHECK INCOMPLETE: review missing/invalid server-side secrets in Cloudflare Pages Production settings.");
} else {
  console.log("PASS: Production Census -> signed proof -> PVWatts/OpenEI provider path is operational.");
}
