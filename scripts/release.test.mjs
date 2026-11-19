import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./release.mjs', import.meta.url));
const sha = 'a'.repeat(40);
const validate = (...inputs) =>
  spawnSync(process.execPath, [script, 'validate', ...inputs], { encoding: 'utf8' });

test('release validation distinguishes missing, malformed, and whitespace-padded tags', () => {
  for (const [args, expected] of [
    [['candidate'], /tag is missing.*v0\.1\.0-rc\.1/],
    [['candidate', '  ', sha], /tag is missing/],
    [['candidate', '0.1.0-rc.1', sha], /wrong format for candidate.*leading v/],
    [['promote', 'v0.1.0'], /wrong format for promote.*v0\.1\.0-rc\.1/],
    [['rollback', 'v0.1.0-rc.1'], /wrong format for rollback.*stable tag such as v0\.1\.0/],
    [['promote', 'v0.1.0-rc.1\n'], /trailing whitespace/],
  ]) {
    const result = validate(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /AssertionError|\n\s+at /);
  }
});

test('candidate validation explains missing or malformed source SHAs', () => {
  const tag = 'v0.1.0-rc.1';
  assert.match(validate('candidate', tag).stderr, /Source SHA is missing.*40-character/);
  assert.match(validate('candidate', tag, 'abc123').stderr, /Source SHA has the wrong format.*40-character/);
});

test('valid tags for all three operations pass', () => {
  assert.equal(validate('candidate', 'v0.1.0-rc.1', sha).status, 0);
  assert.equal(validate('promote', 'v0.1.0-rc.1').status, 0);
  assert.equal(validate('rollback', 'v0.1.0').status, 0);
});

test('deployment preflight identifies missing settings before contacting Cloudflare', async () => {
  const { deploymentOrigin, validateDeploymentEnvironment } = await import('./release-smoke.mjs');
  assert.throws(() => validateDeploymentEnvironment({ DEPLOY_URL: 'https://qa.example.com' }),
    /CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.*GitHub Settings/);
  assert.throws(() => deploymentOrigin('qa.example.com'), /full HTTPS address/);
  assert.throws(() => deploymentOrigin('https://qa.example.com/timer'), /without credentials, a path/);
});

test('smoke checks explain what the deployed Worker returned', async () => {
  const { verifyDeployment } = await import('./release-smoke.mjs');
  const origin = new URL('https://qa.example.com');
  const expected = { candidate: 'v0.1.0-rc.1', sourceSha: sha };
  await assert.rejects(verifyDeployment(origin, expected, async () => new Response('', { status: 404 })),
    /qa.example.com\/build-info.json returned HTTP 404/);
  await assert.rejects(verifyDeployment(origin, expected, async () => new Response('not JSON')),
    /did not return valid JSON/);
  await assert.rejects(verifyDeployment(origin, expected, async () => Response.json({ ...expected, candidate: 'v0.1.0-rc.2' })),
    /different build.*Expected v0\.1\.0-rc\.1.*v0\.1\.0-rc\.2/);
  const serve = html => async url => url.pathname === '/build-info.json' ? Response.json(expected) : new Response(html);
  await assert.rejects(verifyDeployment(origin, expected, serve('<main>Other app</main>')),
    /clocks\?cities=london,tokyo.*did not serve Time And Date/);
  await verifyDeployment(origin, expected, serve('<main id="app"></main>'));
});
