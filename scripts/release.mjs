import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { smokeDeployment, validateDeploymentEnvironment } from './release-smoke.mjs';

const candidatePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.[1-9]\d*$/;
const stablePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const shaPattern = /^[a-f0-9]{40}$/;
const [command, operation, tag, sha, majorRelease] = process.argv.slice(2);

function sourceShaError(sha) {
  if (!sha?.trim()) {
    return 'Source SHA is missing. Copy the full 40-character commit SHA from GitHub into source_sha.';
  }
  if (sha.length !== 40 || !shaPattern.test(sha)) {
    return 'Source SHA has the wrong format. Paste the full 40-character lowercase hexadecimal commit SHA into source_sha.';
  }
}

function versionParts(tag) {
  return tag.slice(1).replace('-rc.', '.').split('.').map(BigInt);
}

function newerTag(tag, previous) {
  if (!previous) return true;
  const earlier = versionParts(previous);
  for (const [index, part] of versionParts(tag).entries()) {
    if (part !== earlier[index]) return part > earlier[index];
  }
  return false;
}

function resolveCandidateTag(tag, sha, majorRelease) {
  const error = sourceShaError(sha);
  if (error) throw new Error(error);
  if (tag && majorRelease) throw new Error('Choose either an explicit tag or Major release.');
  if (tag) return tag;

  let packageJson;
  try {
    packageJson = execFileSync('git', ['show', `${sha}:package.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error(`Could not read package.json at ${sha}. Check that the commit exists and contains package.json, or enter an explicit RC tag.`);
  }

  let version;
  try {
    version = JSON.parse(packageJson)?.version;
  } catch {
    throw new Error('Could not read the app version because package.json is invalid JSON. Fix it before cutting a candidate.');
  }
  let stableTag = `v${version}`;
  if (typeof version !== 'string' || version !== version.trim() || !stablePattern.test(stableTag)) {
    throw new Error('Set package.json version to a stable numeric version such as 0.1.0, or enter an explicit RC tag.');
  }
  const tags = new Set(execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trimEnd().split('\n'));
  let latestStable;
  for (const existing of tags) {
    if (stablePattern.test(existing) && newerTag(existing, latestStable)) latestStable = existing;
  }

  if (majorRelease) {
    const [major] = versionParts(latestStable ?? stableTag);
    stableTag = `v${latestStable ? major + 1n : major || 1n}.0.0`;
  } else {
    const reachableTags = execFileSync('git', ['tag', '--merged', sha], { encoding: 'utf8' }).trimEnd().split('\n');
    let activeVersion;
    for (const existing of reachableTags) {
      if (!candidatePattern.test(existing)) continue;
      const target = existing.split('-rc.')[0];
      if ((!latestStable || newerTag(target, latestStable)) &&
          (target === stableTag || newerTag(target, stableTag)) &&
          newerTag(target, activeVersion)) activeVersion = target;
    }
    if (activeVersion) {
      stableTag = activeVersion;
    } else if (latestStable && !newerTag(stableTag, latestStable)) {
      const [major, minor] = versionParts(latestStable);
      stableTag = `v${major}.${minor + 1n}.0`;
    }
  }

  let highest = 0n;
  for (const existing of tags) {
    if (!existing.startsWith(`${stableTag}-rc.`) || !candidatePattern.test(existing)) continue;
    const number = BigInt(existing.slice(`${stableTag}-rc.`.length));
    if (number > highest) highest = number;
  }
  return `${stableTag}-rc.${highest + 1n}`;
}

function resolvePromotionTag(publishedTags) {
  const tags = new Set(execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trimEnd().split('\n'));
  let selected;
  for (const tag of publishedTags.split('\n')) {
    if (!candidatePattern.test(tag) || !tags.has(tag) || tags.has(tag.split('-rc.')[0])) continue;
    if (newerTag(tag, selected)) selected = tag;
  }
  if (!selected) {
    throw new Error('No published release candidate is eligible for promotion. Run candidate and verify it in QA first.');
  }
  return selected;
}

function validateReleaseInputs(operation, tag, sha) {
  if (!['candidate', 'promote', 'rollback'].includes(operation)) {
    return 'Choose candidate, promote, or rollback in the operation field.';
  }

  const rollback = operation === 'rollback';
  const expected = rollback
    ? 'Enter a stable tag such as v0.1.0.'
    : 'Enter an RC tag such as v0.1.0-rc.1, with a leading v and an RC number of 1 or higher.';

  if (!tag?.trim()) return `Release tag is missing. ${expected}`;
  if (tag !== tag.trim()) return `Release tag contains leading or trailing whitespace. Remove the extra whitespace. ${expected}`;
  if (!(rollback ? stablePattern : candidatePattern).test(tag)) {
    return `Release tag ${JSON.stringify(tag)} has the wrong format for ${operation}. ${expected}`;
  }
  if (operation === 'candidate') return sourceShaError(sha);
}

try {
  if (command === 'validate' || command === 'stamp') {
    const error = validateReleaseInputs(command === 'stamp' ? 'candidate' : operation, tag, sha);
    if (error) throw new Error(error);
    if (command === 'stamp') {
      try {
        writeFileSync('dist/build-info.json', JSON.stringify({ candidate: tag, sourceSha: sha }) + '\n');
      } catch (error) {
        throw new Error(`Could not write dist/build-info.json (${error.code}). Build the web app first and check that dist/ is writable.`);
      }
    }
  } else if (command === 'resolve-candidate' && operation === 'candidate') {
    const resolved = resolveCandidateTag(tag, sha, majorRelease === 'true');
    const error = validateReleaseInputs('candidate', resolved, sha);
    if (error) throw new Error(error);
    console.log(resolved);
  } else if (command === 'resolve-promote') {
    console.log(resolvePromotionTag(readFileSync(0, 'utf8')));
  } else if (command === 'check-deploy') {
    validateDeploymentEnvironment(process.env);
  } else if (command === 'smoke') {
    await smokeDeployment(operation);
  } else {
    throw new Error('Choose a release command: validate, resolve-candidate, resolve-promote, stamp, check-deploy, or smoke.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
