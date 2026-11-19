import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const candidatePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.[1-9]\d*$/;
const stablePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const shaPattern = /^[a-f0-9]{40}$/;
const [command, operation, tag, sha] = process.argv.slice(2);

if (command === 'validate') {
  assert.ok(['candidate', 'promote', 'rollback'].includes(operation), 'Invalid operation');
  assert.ok((operation === 'rollback' ? stablePattern : candidatePattern).test(tag), 'Invalid release tag');
  if (operation === 'candidate') assert.match(sha, shaPattern, 'Enter the full source commit SHA');
} else if (command === 'stamp') {
  assert.match(tag, candidatePattern);
  assert.match(sha, shaPattern);
  writeFileSync('dist/build-info.json', JSON.stringify({ candidate: tag, sourceSha: sha }) + '\n');
} else if (command === 'smoke') {
  const origin = new URL(operation);
  assert.equal(origin.protocol, 'https:');
  const expected = JSON.parse(readFileSync('dist/build-info.json', 'utf8'));
  const navigation = { headers: { 'Sec-Fetch-Mode': 'navigate' }, signal: AbortSignal.timeout(10000) };
  for (let attempt = 0; ; attempt++) {
    try {
      const identity = await fetch(new URL('/build-info.json', origin), navigation);
      assert.ok(identity.ok);
      assert.deepEqual(await identity.json(), expected, 'Deployment build identity differs');
      for (const path of ['/clocks?cities=london,tokyo', '/timer']) {
        const page = await fetch(new URL(path, origin), navigation);
        assert.ok(page.ok && (await page.text()).includes('id="app"'), `Missing app at ${path}`);
      }
      break;
    } catch (error) {
      if (attempt === 7) throw error;
      await delay(5000);
    }
  }
} else {
  throw new Error('Unknown release command');
}
