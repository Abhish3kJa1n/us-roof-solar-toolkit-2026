#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  cloudflareAccessHeadersForUrl,
  isCloudflareAccessChallenge,
  installCloudflareAccess,
  fetchPreview,
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

  assert.deepEqual(
    cloudflareAccessHeadersForUrl('https://roof-solar-toolkit-2026.pages.dev/', 'https://roof-solar-toolkit-2026.pages.dev'),
    {},
    'the root Pages hostname is supported before Access is enabled',
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
    cloudflareAccessHeadersForUrl('https://roof-solar-toolkit-2026.pages.dev/', 'https://roof-solar-toolkit-2026.pages.dev'),
    {
      'CF-Access-Client-Id': 'test-client-id',
      'CF-Access-Client-Secret': 'test-client-secret',
    },
    'service-token headers must also support the separately protected root Pages hostname',
  );
  assert.deepEqual(
    cloudflareAccessHeadersForUrl('https://other.roof-solar-toolkit-2026.pages.dev/', base),
    {},
    'service-token headers must be scoped to the exact Preview origin, not every pages.dev subdomain',
  );

  let routeHandler;
  await installCloudflareAccess({
    route: async (pattern, handler) => {
      assert.equal(pattern, '**/*');
      routeHandler = handler;
    },
  }, base);

  let externalRouteOptions;
  await routeHandler({
    request: () => ({
      url: () => 'https://cdn.example.com/app.js',
      headers: () => ({
        accept: '*/*',
        'cf-access-client-id': 'inherited-id',
        'cf-access-client-secret': 'inherited-secret',
      }),
    }),
    continue: async (options) => { externalRouteOptions = options; },
  });
  assert.equal(externalRouteOptions.headers['cf-access-client-id'], undefined, 'Access client ID must be stripped from off-origin requests');
  assert.equal(externalRouteOptions.headers['cf-access-client-secret'], undefined, 'Access client secret must be stripped from off-origin requests');
  assert.equal(externalRouteOptions.headers.accept, '*/*', 'ordinary request headers must be preserved');

  let previewRouteOptions;
  await routeHandler({
    request: () => ({
      url: () => base + '/app.js',
      headers: () => ({ accept: '*/*' }),
    }),
    continue: async (options) => { previewRouteOptions = options; },
  });
  assert.equal(previewRouteOptions.headers['CF-Access-Client-Id'], 'test-client-id');
  assert.equal(previewRouteOptions.headers['CF-Access-Client-Secret'], 'test-client-secret');

  const originalFetch = globalThis.fetch;
  try {
    const fetchCalls = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), headers: Object.fromEntries(init.headers.entries()), redirect: init.redirect });
      return new Response('', {
        status: 302,
        headers: { location: 'https://roof-solar-toolkit-2026.cloudflareaccess.com/cdn-cgi/access/login' },
      });
    };
    const redirectResponse = await fetchPreview(base + '/', {}, base);
    assert.equal(redirectResponse.status, 302);
    assert.equal(fetchCalls.length, 1, 'cross-origin Access redirects must not be followed');
    assert.equal(fetchCalls[0].headers['cf-access-client-id'], 'test-client-id');
    assert.equal(fetchCalls[0].headers['cf-access-client-secret'], 'test-client-secret');
    assert.equal(fetchCalls[0].redirect, 'manual');
  } finally {
    globalThis.fetch = originalFetch;
  }

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
  assert.equal(
    isCloudflareAccessChallenge({
      status: () => 302,
      url: () => base + '/',
      headers: () => ({ location: 'https://roof-solar-toolkit-2026.cloudflareaccess.com/cdn-cgi/access/login' }),
    }),
    true,
    'Playwright response methods must also be understood',
  );

  console.log('PASS: Cloudflare Access headers are optional, paired, exact-origin scoped and login redirects are detected.');
} finally {
  if (originalId === undefined) delete process.env.CF_ACCESS_CLIENT_ID;
  else process.env.CF_ACCESS_CLIENT_ID = originalId;
  if (originalSecret === undefined) delete process.env.CF_ACCESS_CLIENT_SECRET;
  else process.env.CF_ACCESS_CLIENT_SECRET = originalSecret;
}
