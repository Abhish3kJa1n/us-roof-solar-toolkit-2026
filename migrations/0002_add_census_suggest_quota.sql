-- Expand the aggregate quota scope allowlist for nationwide Census city suggestions.
-- Rebuild the table because SQLite cannot alter an existing CHECK constraint.
-- Every existing counter row is copied unchanged before the old table is dropped.
CREATE TABLE api_quota_new (
  scope TEXT PRIMARY KEY CHECK (scope IN ('census', 'census_suggest', 'pvwatts', 'openei')),
  window_bucket INTEGER NOT NULL,
  window_count INTEGER NOT NULL CHECK (window_count >= 1),
  day_bucket INTEGER NOT NULL,
  day_count INTEGER NOT NULL CHECK (day_count >= 1),
  updated_at INTEGER NOT NULL
);
INSERT INTO api_quota_new (scope, window_bucket, window_count, day_bucket, day_count, updated_at)
SELECT scope, window_bucket, window_count, day_bucket, day_count, updated_at FROM api_quota;
DROP TABLE api_quota;
ALTER TABLE api_quota_new RENAME TO api_quota;
