/** Atomic, aggregate-only request quotas backed by one shared D1 database. */
const QUOTA_SQL = `
  INSERT INTO api_quota (scope, window_bucket, window_count, day_bucket, day_count, updated_at)
  VALUES (?1, ?2, 1, ?3, 1, ?4)
  ON CONFLICT(scope) DO UPDATE SET
    window_count = CASE WHEN api_quota.window_bucket = excluded.window_bucket
      THEN api_quota.window_count + 1 ELSE 1 END,
    window_bucket = excluded.window_bucket,
    day_count = CASE WHEN api_quota.day_bucket = excluded.day_bucket
      THEN api_quota.day_count + 1 ELSE 1 END,
    day_bucket = excluded.day_bucket,
    updated_at = excluded.updated_at
  WHERE
    (CASE WHEN api_quota.window_bucket = excluded.window_bucket
      THEN api_quota.window_count ELSE 0 END) < ?5
    AND
    (CASE WHEN api_quota.day_bucket = excluded.day_bucket
      THEN api_quota.day_count ELSE 0 END) < ?6
  RETURNING window_count AS windowCount, day_count AS dayCount
`;

/**
 * Reserves one request atomically on D1's primary database instance.
 * Returns null when either cap is exhausted. Throws if the binding/query fails.
 */
export async function reserveApiQuota(db, scope, windowLimit, dailyLimit, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') throw new Error('D1 quota binding is missing.');
  if (!['census', 'pvwatts', 'openei'].includes(scope)) throw new Error('Unknown API quota scope.');
  if (!Number.isInteger(windowLimit) || windowLimit < 1 || !Number.isInteger(dailyLimit) || dailyLimit < 1) {
    throw new Error('Invalid API quota limits.');
  }
  const windowBucket = Math.floor(now / (15 * 60 * 1000));
  const dayBucket = Math.floor(now / 86400000);
  return db.prepare(QUOTA_SQL)
    .bind(scope, windowBucket, dayBucket, now, windowLimit, dailyLimit)
    .first();
}
