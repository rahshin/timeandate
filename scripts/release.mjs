import { writeFileSync } from 'node:fs';
import { smokeDeployment, validateDeploymentEnvironment } from './release-smoke.mjs';

const candidatePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.[1-9]\d*$/;
const stablePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const shaPattern = /^[a-f0-9]{40}$/;
const [command, operation, tag, sha] = process.argv.slice(2);

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
  if (operation === 'candidate' && !sha?.trim()) {
    return 'Source SHA is missing. Copy the full 40-character commit SHA from GitHub into source_sha.';
  }
  if (operation === 'candidate' && (sha.length !== 40 || !shaPattern.test(sha))) {
    return 'Source SHA has the wrong format. Paste the full 40-character lowercase hexadecimal commit SHA into source_sha.';
  }
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
  } else if (command === 'check-deploy') {
    validateDeploymentEnvironment(process.env);
  } else if (command === 'smoke') {
    await smokeDeployment(operation);
  } else {
    throw new Error('Choose a release command: validate, stamp, check-deploy, or smoke.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
