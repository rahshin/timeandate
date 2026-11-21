import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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


test('automatic candidates use the pinned version, advance shipped minor lines, and increment RC numbers', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'timeandate-release-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  writeFileSync(join(cwd, 'package.json'), '{"version":"0.1.0"}');
  git('add', 'package.json');
  git('-c', 'user.name=Release Test', '-c', 'user.email=release@example.test', 'commit', '--quiet', '-m', 'Initial version');
  const source = git('rev-parse', 'HEAD');
  writeFileSync(join(cwd, 'package.json'), '{"version":"9.0.0"}');
  const resolveTag = (tag = '') => spawnSync(process.execPath, [script, 'resolve-candidate', 'candidate', tag, source], { cwd, encoding: 'utf8' });
  assert.equal(resolveTag().stdout.trim(), 'v0.1.0-rc.1');
  for (const tag of ['v0.1.0-rc.2', 'v0.1.0-rc.10', 'v0.1.0-rc.99-extra', 'v9.0.0-rc.50']) git('tag', tag);
  assert.equal(resolveTag().stdout.trim(), 'v0.1.0-rc.11');
  assert.equal(resolveTag('v1.0.0-rc.1').stdout.trim(), 'v1.0.0-rc.1');
  git('tag', 'v0.1.0');
  const nextMinor = resolveTag();
  assert.equal(nextMinor.status, 0, nextMinor.stderr);
  assert.equal(nextMinor.stdout.trim(), 'v0.2.0-rc.1');
  for (const tag of ['v0.2.0-rc.2', 'v0.2.0-rc.10', 'v0.2.0-rc.99-extra']) git('tag', tag);
  assert.equal(resolveTag().stdout.trim(), 'v0.2.0-rc.11');
  git('tag', 'v0.2.0');
  assert.equal(resolveTag().stdout.trim(), 'v0.3.0-rc.1');
  assert.equal(resolveTag('v0.1.1-rc.1').stdout.trim(), 'v0.1.1-rc.1');
});

test('automatic promotion selects the highest published RC for an unshipped version', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'timeandate-promote-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  git('init', '--quiet');
  git('-c', 'user.name=Release Test', '-c', 'user.email=release@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'Initial commit');
  for (const tag of ['v1.9.0-rc.99', 'v1.10.0-rc.2', 'v1.10.0-rc.10', 'v1.10.0-rc.11', 'v2.0.0-rc.4', 'v2.0.0']) {
    git('tag', tag);
  }
  const resolveTag = input => spawnSync(process.execPath, [script, 'resolve-promote'], { cwd, encoding: 'utf8', input });
  const published = resolveTag('v2.0.0-rc.4\nv1.10.0-rc.10\nv1.9.0-rc.99\nv1.10.0-rc.2\nv3.0.0-rc.1\n');
  assert.equal(published.status, 0, published.stderr);
  assert.equal(published.stdout.trim(), 'v1.10.0-rc.10');

  const unavailable = resolveTag('v2.0.0-rc.4\nv3.0.0-rc.1\n');
  assert.equal(unavailable.status, 1);
  assert.match(unavailable.stderr, /No published release candidate is eligible/);
});

test('release smoke checks the standalone timer paths used by the selected bundle', async () => {
  const { verifyDeployment } = await import('./release-smoke.mjs');
  const origin = new URL('https://example.test');
  const expected = { candidate: 'v0.2.0-rc.1', sourceSha: sha };
  const legacy = async url => url.pathname === '/build-info.json'
    ? Response.json(expected)
    : new Response('<main id="app"></main>');
  await verifyDeployment(origin, expected, legacy);
  await assert.rejects(verifyDeployment(origin, expected, legacy, { standalonePath: '/interval-timer-app' }),
    /interval-timer-app\/ did not serve the expected interval timer build file/);
  for (const [timerName, countdownPath, timerPath] of [
    ['multi-timer', '/timer', '/multi-timer'],
    ['interval-timer', '/countdown'],
  ]) {
    const standalonePath = `/${timerName}-app`;
    const files = {
      [`${standalonePath}/`]: '<main class="multi-standalone" id="app">',
      [`${standalonePath}/manifest.webmanifest`]: '{"display": "standalone"}',
      [`${standalonePath}/sw.js`]: `const CACHE = "timeandate-${timerName}-demo";`,
    };
    const paths = [];
    await verifyDeployment(origin, expected, async url => {
      paths.push(url.pathname);
      return Object.hasOwn(files, url.pathname) ? new Response(files[url.pathname]) : legacy(url);
    }, { standalonePath, renamedTimerRoutes: countdownPath === '/countdown' });
    assert.deepEqual(paths.slice(1), ['/clocks', countdownPath, ...(timerPath ? [timerPath] : []), ...Object.keys(files)]);
  }
});
