import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"));
const assets = new Set([
  "/interval-timer-app/",
  "/interval-timer-app/manifest.webmanifest",
  "/interval-timer-app/icon-192.png",
  "/interval-timer-app/icon-512.png",
]);
const visited = new Set();

function collect(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) throw new Error(`Interval Timer build entry is missing: ${key}`);
  for (const path of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    assets.add(`/${path}`);
  }
  for (const dependency of entry.imports || []) collect(dependency);
}

collect("interval-timer-app/index.html");
const worker = readFileSync(new URL("./interval-timer-sw.js", import.meta.url), "utf8");
const hash = createHash("sha256").update(worker);
for (const asset of assets) {
  const file = asset.endsWith("/") ? `dist${asset}index.html` : `dist${asset}`;
  hash.update(asset).update(readFileSync(file));
}
const cache = `timeandate-interval-timer-${hash.digest("hex").slice(0, 16)}`;
writeFileSync(
  "dist/interval-timer-app/sw.js",
  `const CACHE = ${JSON.stringify(cache)};\nconst ASSETS = ${JSON.stringify([...assets])};\n${worker}`,
);
