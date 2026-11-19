import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

export function deploymentOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Set DEPLOY_URL to the full HTTPS address of this environment’s Worker in GitHub Settings → Environments.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Set DEPLOY_URL to the Worker’s HTTPS origin, for example https://timeandate.example.com, without credentials, a path, or query parameters.');
  }
  return url;
}

export function validateDeploymentEnvironment(env) {
  const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'DEPLOY_URL']
    .filter(key => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing deployment settings: ${missing.join(', ')}. In GitHub Settings → Environments, add CLOUDFLARE_API_TOKEN as a secret and CLOUDFLARE_ACCOUNT_ID and DEPLOY_URL as variables for the target environment.`);
  }
  deploymentOrigin(env.DEPLOY_URL);
}

async function fetchPage(origin, path, fetchPageImpl) {
  let response;
  try {
    response = await fetchPageImpl(new URL(path, origin), {
      headers: { 'Sec-Fetch-Mode': 'navigate' },
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    const reason = error.cause?.code || error.code || error.name;
    throw new Error(`Could not reach ${origin.host}${path} (${reason}). Check DEPLOY_URL, DNS, and the Worker’s public route.`);
  }
  if (!response.ok) {
    throw new Error(`${origin.host}${path} returned HTTP ${response.status}. Check that DEPLOY_URL points to the deployed Worker and that the route is publicly accessible.`);
  }
  return response;
}

export async function verifyDeployment(origin, expected, fetchPageImpl = fetch) {
  const response = await fetchPage(origin, '/build-info.json', fetchPageImpl);
  let actual;
  try {
    actual = await response.json();
  } catch {
    throw new Error(`${origin.host}/build-info.json did not return valid JSON. Check the Worker URL and that the bundle includes its build manifest.`);
  }
  if (actual?.candidate !== expected.candidate || actual?.sourceSha !== expected.sourceSha) {
    throw new Error(`${origin.host} is serving a different build. Expected ${expected.candidate} (${expected.sourceSha}); received ${JSON.stringify({ candidate: actual?.candidate ?? null, sourceSha: actual?.sourceSha ?? null })}. Check which Worker DEPLOY_URL points to and whether the latest deployment is active.`);
  }
  for (const path of ['/clocks?cities=london,tokyo', '/timer']) {
    const page = await fetchPage(origin, path, fetchPageImpl);
    if (!(await page.text()).includes('id="app"')) {
      throw new Error(`${origin.host}${path} returned HTTP ${page.status} but did not serve Time And Date. Check the Worker’s static assets and single-page application routing.`);
    }
  }
}

export async function smokeDeployment(value) {
  const origin = deploymentOrigin(value);
  let expected;
  try {
    expected = JSON.parse(readFileSync('dist/build-info.json', 'utf8'));
  } catch {
    throw new Error('The unpacked release is missing a readable dist/build-info.json. Check the selected bundle or build a new candidate.');
  }
  if (!expected?.candidate || !expected?.sourceSha) {
    throw new Error('The unpacked build manifest is missing its candidate tag or source SHA. Check the selected bundle or build a new candidate.');
  }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      return await verifyDeployment(origin, expected);
    } catch (error) {
      if (attempt === 8) throw new Error(`Deployment verification failed after ${attempt} attempts. ${error.message}`);
      await delay(5000);
    }
  }
}
