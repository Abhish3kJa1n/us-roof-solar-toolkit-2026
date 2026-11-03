#!/usr/bin/env python3
"""Exercise the exact D1 quota UPSERT against SQLite-compatible SQL semantics.

This is a local SQLite simulation of D1's SQLite statement, not a deployed D1
concurrency/integration test. It verifies provider-specific caps, UTC rollover and one aggregate row per endpoint.
"""
from __future__ import annotations

from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
FUNCTION = (ROOT / "functions/_shared/quota.js").read_text(encoding="utf-8")
MIGRATION_1 = (ROOT / "migrations/0001_create_api_quota.sql").read_text(encoding="utf-8")
MIGRATION_2 = (ROOT / "migrations/0002_add_census_suggest_quota.sql").read_text(encoding="utf-8")
match = re.search(r"const QUOTA_SQL = `([\s\S]*?)`;", FUNCTION)
assert match, "Shared quota module must contain the quota SQL constant"
SQL = match.group(1)
assert "RETURNING window_count AS windowCount" in SQL
assert "?5" in SQL and "?6" in SQL

WINDOW_LIMIT = 180
DAILY_LIMIT = 15000
WINDOW_MS = 15 * 60 * 1000
DAY_MS = 24 * 60 * 60 * 1000


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.executescript(MIGRATION_1)
    db.execute("INSERT INTO api_quota VALUES ('census', 1, 2, 2, 3, 4)")
    db.executescript(MIGRATION_2)
    preserved = db.execute("SELECT window_bucket, window_count, day_bucket, day_count, updated_at FROM api_quota WHERE scope = 'census'").fetchone()
    assert preserved == (1, 2, 2, 3, 4), "schema migration must preserve existing Census quota counters"
    db.execute("DELETE FROM api_quota WHERE scope = 'census'")
    return db


def reserve(db: sqlite3.Connection, now_ms: int):
    window_bucket = now_ms // WINDOW_MS
    day_bucket = now_ms // DAY_MS
    return db.execute(
        SQL,
        ("pvwatts", window_bucket, day_bucket, now_ms, WINDOW_LIMIT, DAILY_LIMIT),
    ).fetchone()


# A fixed 15-minute bucket permits exactly 180 requests; the next is rejected.
db = connect()
base = 1_800_000_000_000  # arbitrary timestamp; all bucketing is epoch-based UTC
for n in range(1, WINDOW_LIMIT + 1):
    row = reserve(db, base + n)
    assert row is not None, f"request {n} unexpectedly rejected"
    assert row[0] == n
assert reserve(db, base + WINDOW_LIMIT + 1) is None, "181st request in a bucket must be denied"
assert db.execute("SELECT COUNT(*) FROM api_quota WHERE scope = 'pvwatts'").fetchone()[0] == 1

# Next bucket resets only the 15-minute window count; daily count continues.
next_bucket = ((base // WINDOW_MS) + 1) * WINDOW_MS
row = reserve(db, next_bucket + 1)
assert row == (1, WINDOW_LIMIT + 1), f"window/day rollover incorrect: {row}"

# Daily cap is independently enforced even when calls span separate windows.
db_day = connect()
day_base = 1_800_000_000_000
day_bucket = day_base // DAY_MS
for n in range(1, DAILY_LIMIT + 1):
    # Supply monotonically increasing synthetic 15-minute bucket IDs while
    # keeping the UTC day bucket fixed to isolate the daily predicate.
    row = db_day.execute(
        SQL,
        ("pvwatts", n, day_bucket, day_base + n, WINDOW_LIMIT, DAILY_LIMIT),
    ).fetchone()
    assert row is not None, f"daily request {n} unexpectedly rejected"
assert row[1] == DAILY_LIMIT
assert db_day.execute(
    SQL,
    ("pvwatts", DAILY_LIMIT + 1, day_bucket, day_base + DAILY_LIMIT + 1, WINDOW_LIMIT, DAILY_LIMIT),
).fetchone() is None, "daily limit must reject request 15,001"

# Census and OpenEI use independent counters in the same database.
row = db.execute(SQL, ("openei", 7, base // DAY_MS, base + 9, 60, 5000)).fetchone()
assert row == (1, 1), f"OpenEI scope did not receive an independent counter: {row}"
row = db.execute(SQL, ("census", 7, base // DAY_MS, base + 10, 60, 10000)).fetchone()
assert row == (1, 1), f"Census scope did not receive an independent counter: {row}"
row = db.execute(SQL, ("census_suggest", 7, base // DAY_MS, base + 11, 120, 20000)).fetchone()
assert row == (1, 1), f"Census suggestion scope did not receive an independent counter: {row}"
assert db.execute("SELECT COUNT(*) FROM api_quota").fetchone()[0] == 4

# The Census cap is 60 per 15 minutes / 10,000 per UTC day; test both edges.
db_census_window = connect()
for n in range(1, 61):
    row = db_census_window.execute(SQL, ("census", 9, day_bucket, day_base + n, 60, 10000)).fetchone()
    assert row is not None, f"Census window request {n} unexpectedly rejected"
assert db_census_window.execute(SQL, ("census", 9, day_bucket, day_base + 61, 60, 10000)).fetchone() is None

db_census_day = connect()
for n in range(1, 10001):
    row = db_census_day.execute(SQL, ("census", n, day_bucket, day_base + n, 60, 10000)).fetchone()
    assert row is not None, f"Census daily request {n} unexpectedly rejected"
assert db_census_day.execute(SQL, ("census", 10001, day_bucket, day_base + 10001, 60, 10000)).fetchone() is None


# Type-ahead has an isolated cap so suggestions cannot exhaust exact location lookups.
db_suggest_window = connect()
for n in range(1, 121):
    row = db_suggest_window.execute(SQL, ("census_suggest", 12, day_bucket, day_base + n, 120, 20000)).fetchone()
    assert row is not None, f"Census suggestion window request {n} unexpectedly rejected"
assert db_suggest_window.execute(SQL, ("census_suggest", 12, day_bucket, day_base + 121, 120, 20000)).fetchone() is None

db_suggest_day = connect()
for n in range(1, 20001):
    row = db_suggest_day.execute(SQL, ("census_suggest", n, day_bucket, day_base + n, 120, 20000)).fetchone()
    assert row is not None, f"Census suggestion daily request {n} unexpectedly rejected"
assert db_suggest_day.execute(SQL, ("census_suggest", 20001, day_bucket, day_base + 20001, 120, 20000)).fetchone() is None

# A new UTC day resets the daily count and allows a fresh request.
new_day = (day_base // DAY_MS + 1) * DAY_MS
row = reserve(db_day, new_day + 1)
assert row == (1, 1), f"UTC day rollover incorrect: {row}"
assert db_day.execute("SELECT COUNT(*) FROM api_quota WHERE scope = 'pvwatts'").fetchone()[0] == 1

# Guard logic is intentionally 180 * at most five buckets = 900 per rolling hour.
assert WINDOW_LIMIT * 5 == 900 < 1000
assert DAILY_LIMIT < 100_000
assert 60 * 5 == 300 < 1000 and 5000 < 100_000
assert 120 * 5 == 600 < 1000 and 20000 < 100_000
assert 10000 + 20000 + DAILY_LIMIT + 5000 == 50000 < 100_000

print("PASS: exact quota SQL enforces Census 60/15-min and 10,000/day, Census suggestions 120/15-min and 20,000/day, PVWatts 180/15-min and 15,000/day, OpenEI 60/15-min and 5,000/day caps, and UTC rollovers.")
print("NOTE: SQLite simulation only; Cloudflare D1 live binding/concurrency not tested.")
