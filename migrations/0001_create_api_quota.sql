-- Aggregate-only quota counters for the public Census, PVWatts and OpenEI proxies.
-- Rows contain no IP addresses, city names, coordinates or visitor identifiers.
CREATE TABLE IF NOT EXISTS api_quota (
  scope TEXT PRIMARY KEY CHECK (scope IN ('census', 'pvwatts', 'openei')),
  window_bucket INTEGER NOT NULL,
  window_count INTEGER NOT NULL CHECK (window_count >= 1),
  day_bucket INTEGER NOT NULL,
  day_count INTEGER NOT NULL CHECK (day_count >= 1),
  updated_at INTEGER NOT NULL
);
