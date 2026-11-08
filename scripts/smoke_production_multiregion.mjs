#!/usr/bin/env node
import assert from "node:assert/strict";

const BASE = process.env.PRODUCTION_BASE_URL || "https://roof-solar-toolkit-2026.pages.dev";
const PLACES = [
  { city: "Seattle", state: "WA", region: "Pacific Northwest" },
  { city: "Phoenix", state: "AZ", region: "Southwest" },
  { city: "Miami", state: "FL", region: "Southeast" },
  { city: "Boston", state: "MA", region: "Northeast" },
  { city: "Anchorage", state: "AK", region: "Alaska" },
  { city: "Honolulu", state: "HI", region: "Hawaii" },
];

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

const results = [];
for (const target of PLACES) {
  // Deliberately sequential: each successful exact lookup/model/rate query
  // reserves one request in the shared D1 quota guard.
  const locationPath = "/api/location?" + new URLSearchParams({
    city: target.city,
    state: target.state,
  }).toString();
  const census = await getJson(locationPath);
  assert.equal(
    census.response.status,
    200,
    target.city + ", " + target.state + ": Census exact-place lookup failed (" + census.response.status + "): " + String(census.body.error || ""),
  );
  assert.ok(Array.isArray(census.body.places), target.city + ": Census response must contain places");
  const place = census.body.places.find((item) =>
    item.stateAbbreviation === target.state
    && String(item.placeName || "").toLowerCase() === target.city.toLowerCase()
    && Number.isFinite(Number(item.latitude))
    && Number.isFinite(Number(item.longitude))
  );
  assert.ok(place, target.city + ", " + target.state + ": exact Census place with valid coordinates was not returned");
  assert.ok(typeof place.locationToken === "string" && place.locationToken.length > 0, target.city + ": signed location proof missing");

  const pvParams = new URLSearchParams({
    lat: String(place.latitude),
    lon: String(place.longitude),
    state: target.state,
    capacity: "1",
    tilt: "20",
    azimuth: "180",
    losses: "14",
  });
  const pv = await getJson("/api/pvwatts?" + pvParams.toString(), {
    "X-Location-Proof": place.locationToken,
  });
  assert.equal(
    pv.response.status,
    200,
    target.city + ", " + target.state + ": PVWatts failed (" + pv.response.status + "): " + String(pv.body.error || ""),
  );
  const annual = Number(pv.body.outputs?.annualAcKwh);
  const monthly = pv.body.outputs?.monthlyAcKwh;
  assert.ok(Number.isFinite(annual) && annual > 0, target.city + ": PVWatts annual AC output must be positive");
  assert.ok(Array.isArray(monthly) && monthly.length === 12, target.city + ": PVWatts must return 12 monthly values");
  assert.ok(monthly.every((value) => Number.isFinite(Number(value)) && Number(value) >= 0), target.city + ": PVWatts monthly values must be finite and non-negative");

  let stationDistanceMiles = null;
  const stationDistanceMeters = Number(pv.body.stationInfo?.distance);
  if (Number.isFinite(stationDistanceMeters)) {
    stationDistanceMiles = stationDistanceMeters / 1609.344;
    assert.ok(
      stationDistanceMeters >= 0 && stationDistanceMiles <= 100,
      target.city + ": PVWatts weather station is outside the configured 100-mile radius (" + stationDistanceMiles.toFixed(2) + " miles)",
    );
  }

  const tariffParams = new URLSearchParams({
    lat: String(place.latitude),
    lon: String(place.longitude),
    state: target.state,
  });
  const tariff = await getJson("/api/tariffs?" + tariffParams.toString(), {
    "X-Location-Proof": place.locationToken,
  });
  assert.equal(
    tariff.response.status,
    200,
    target.city + ", " + target.state + ": OpenEI lookup failed (" + tariff.response.status + "): " + String(tariff.body.error || ""),
  );
  assert.ok(Array.isArray(tariff.body.rates), target.city + ": OpenEI response must contain a candidate-rate array");
  // Zero candidates is not a model/API failure: it means no nearby records
  // were returned within the fixed 10-mile residential discovery search.
  const record = {
    city: target.city,
    state: target.state,
    region: target.region,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    annualAcKwhFor1KwDc: Math.round(annual),
    stationDistanceMiles: stationDistanceMiles === null ? null : Number(stationDistanceMiles.toFixed(2)),
    openEiCandidateCount: tariff.body.rates.length,
  };
  results.push(record);
  console.log("PASS: " + target.city + ", " + target.state
    + " — " + record.annualAcKwhFor1KwDc.toLocaleString("en-US") + " kWh/year per 1 kW DC"
    + (stationDistanceMiles === null ? "; station distance not returned" : "; weather station " + stationDistanceMiles.toFixed(2) + " miles away")
    + "; " + record.openEiCandidateCount + " nearby OpenEI candidates.");
}

console.log("PASS: " + results.length + " Census -> signed proof -> PVWatts/OpenEI regional checks completed.");
console.log("LIMITATION: six city representative points, including Alaska and Hawaii, do not establish nationwide PVWatts coverage, actual rooftop production, utility service territories or applicable household tariffs.");
