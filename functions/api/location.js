import { reserveApiQuota } from '../_shared/quota.js';
/**
 * Cloudflare Pages Function: US city/state -> Census representative place point.
 * Primary source: US Census Bureau TIGERweb Current (2026) Incorporated Places
 * and Census Designated Places layers. INTPTLAT/INTPTLON are representative
 * interior points, not property coordinates or utility service boundaries.
 */
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=3600, s-maxage=604800' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  },
});

const STATE_FIPS = {
  AL:'01', AK:'02', AZ:'04', AR:'05', CA:'06', CO:'08', CT:'09', DE:'10', DC:'11',
  FL:'12', GA:'13', HI:'15', ID:'16', IL:'17', IN:'18', IA:'19', KS:'20', KY:'21',
  LA:'22', ME:'23', MD:'24', MA:'25', MI:'26', MN:'27', MS:'28', MO:'29', MT:'30',
  NE:'31', NV:'32', NH:'33', NJ:'34', NM:'35', NY:'36', NC:'37', ND:'38', OH:'39',
  OK:'40', OR:'41', PA:'42', RI:'44', SC:'45', SD:'46', TN:'47', TX:'48', UT:'49',
  VT:'50', VA:'51', WA:'53', WV:'54', WI:'55', WY:'56', PR:'72',
};

const LAYER_URL = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer';
const validCoordinates = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= -15 && lat <= 72 && lon >= -180 && lon <= -60;

async function queryLayer(layerId, city, stateFips) {
  const safeCity = city.replace(/'/g, "''");
  const params = new URLSearchParams({
    where: `UPPER(BASENAME) = UPPER('${safeCity}') AND STATE = '${stateFips}'`,
    outFields: 'BASENAME,NAME,STATE,INTPTLAT,INTPTLON,GEOID,LSADC',
    returnGeometry: 'false',
    f: 'json',
  });
  const response = await fetch(`${LAYER_URL}/${layerId}/query?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 604800, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`Census TIGERweb layer ${layerId} returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`Census TIGERweb layer ${layerId} returned an error`);
  return (Array.isArray(data.features) ? data.features : []).map((feature) => feature.attributes || {});
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const city = (url.searchParams.get('city') || '').trim().replace(/\s+/g, ' ');
  const state = (url.searchParams.get('state') || '').trim().toUpperCase();
  if (city.length < 2 || city.length > 80 || !/^[\p{L}\p{M}0-9 .’'&()\-]+$/u.test(city)) {
    return json({ error: 'Enter a city name using 2–80 letters, numbers, spaces or common punctuation.' }, 400);
  }
  const stateFips = STATE_FIPS[state];
  if (!stateFips) return json({ error: 'Choose a valid US state or territory abbreviation.' }, 400);

  // This public, keyless lookup still consumes a Pages Function and makes two
  // external Census requests. Reserve a site-wide quota before contacting Census.
  // Conservative app-side cap: 60 per 15-minute bucket and 10,000 per UTC day.
  let quota;
  try {
    quota = await reserveApiQuota(env?.API_QUOTA_DB, 'census', 60, 10000);
  } catch {
    return json({ error: 'Location lookup is temporarily paused because its shared request-quota guard is unavailable. Please try again later.' }, 503);
  }
  if (!quota) {
    return json({ error: 'Location lookup has reached its shared request limit. Please retry later.' }, 429);
  }

  const results = await Promise.allSettled([
    queryLayer(28, city, stateFips), // incorporated places
    queryLayer(30, city, stateFips), // census-designated places
  ]);
  const successful = results.map((item, index) => ({ item, geographyType: index === 0 ? 'Incorporated place' : 'Census-designated place' }))
    .filter(({ item }) => item.status === 'fulfilled');
  if (!successful.length) {
    return json({ error: 'The US Census location service is temporarily unavailable. Please try again later.' }, 502);
  }

  const places = [];
  const seen = new Set();
  for (const result of successful) {
    const rows = result.item.value;
    for (const row of rows) {
      const latitude = Number(row.INTPTLAT);
      const longitude = Number(row.INTPTLON);
      const geoid = String(row.GEOID || '').trim();
      const placeName = String(row.BASENAME || '').trim();
      if (!placeName || !geoid || seen.has(geoid) || !validCoordinates(latitude, longitude)) continue;
      seen.add(geoid);
      places.push({
        placeName,
        stateAbbreviation: state,
        latitude,
        longitude,
        geographyType: result.geographyType,
        geoid,
      });
    }
  }

  if (!places.length) {
    return json({ error: `No exact Census place named “${city}” was found in ${state}. Check the city spelling and state.` }, 404);
  }

  return json({
    city,
    state,
    country: 'United States',
    places,
    source: 'US Census Bureau TIGERweb Current (2026), Incorporated Places and Census Designated Places',
    geographyType: 'Census place internal representative point; not a citywide solar average or rooftop coordinate',
    limitation: 'The selected point is a representative point for the Census place. It does not identify a parcel, roof plane, utility service territory, electricity tariff, building-permit jurisdiction or exact weather conditions at a property. City boundaries and service territories do not necessarily align.',
    partialSourceWarning: successful.length < 2 ? 'One Census place layer was unavailable; the returned matches may be incomplete.' : null,
  });
}
