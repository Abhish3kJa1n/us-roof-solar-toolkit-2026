#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  cloudflareAccessHeadersForUrl,
  isCloudflareAccessChallenge,
} from './cloudflare_access.mjs';

const base = 'https://audit-site-seo-privacy-ux-ha.roof-solar-toolkit-2026.pages.dev';
const originalId = process.env.CF_ACCESS_CLIENT_ID;
const originalSecret = process.env.CF_ACCESS_CLIENT_SECRET;
delete process.env.CF_ACCESS_CLIENT_ID;
delete process.env.CF_ACCESS_CLIENT_SECRET;

try {
  assert.deepEqual(
    cloudflareAccessHeadersForUrl(base + '/', base),
    {},
    'public Preview must keep working before Access is enabled',
  );
  assert.deepEqual(
    cloudflareAccessHeadersForUrl('https://getroofsolarcalculator.online/', base),
    {},
    'service-token headers must never be sent to the public production domain',
  );
  assert.deepEqual(
    cloudflareAccessHeadersForUrl('https://example.pages.dev/', base),
    {},
    'service-token headers must never be sent to another Pages project',
  );

  process.env.CF_ACCESS_CLIENT_ID = 'test-client-id';
  assert.throws(
    () => cloudflareAccessHeadersForUrl(base + '/', base),
    /both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/i,
    'partial credentials must fail clearly',
  );

  process.env.CF_ACCESS_CLIENT_SECRET = 'test-client-secret';
  assert.deepEqual(
    cloudflareAccessHeadersForUrl(base + '/', base),
    {
      'CF-Access-Client-Id': 'test-client-id',
      'CF-Access-Client-Secret': 'test-client-secret',
    },
    'valid service-token headers must be added to the configured Preview origin',
  );
  assert.deepEqual(
    cloudflareAccessHeadersForUrl('https://other.roof-solar-toolkit-2026.pages.dev/', base),
    {},
    'service-token headers must be scoped to the exact Preview origin, not every pages.dev subdomain',
  );

  assert.equal(
    isCloudflareAccessChallenge({
      status: 302,
      url: base + '/',
      headers: { get: (name) => name === 'location' ? 'https://roof-solar-toolkit-2026.cloudflareaccess.com/cdn-cgi/access/login' : null },
    }),
    true,
    'Cloudflare Access login redirects must be detected',
  );
  assert.equal(
    isCloudflareAccessChallenge({ status: 200, url: base + '/', headers: { get: () => null } }),
    false,
    'ordinary successful Preview responses must not be classified as Access challenges',
  );

  console.log('PASS: Cloudflare Access headers are optional, paired, exact-origin scoped and login redirects are detected.');
} finally {
  if (originalId === undefined) delete process.env.CF_ACCESS_CLIENT_ID;
  else process.env.CF_ACCESS_CLIENT_ID = originalId;
  if (originalSecret === undefined) delete process.env.CF_ACCESS_CLIENT_SECRET;
  else process.env.CF_ACCESS_CLIENT_SECRET = originalSecret;
}
