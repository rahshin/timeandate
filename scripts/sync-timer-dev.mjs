import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = join(root, "artifacts/timer-dev");
const { appId, appName } = JSON.parse(readFileSync(join(root, "capacitor.config.json")));
const devId = appId + ".timers.dev";
const devName = "Time And Date Timers Dev";

// Use the checked-in platform files as templates, excluding local SDK settings and build output.
const files = execFileSync("git", ["ls-files", "-z", "--", "ios", "android"], { cwd: root, encoding: "utf8" });
for (const file of files.split("\0").filter(Boolean)) {
  const target = join(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, file), target);
}

const dependencies = join(destination, "node_modules");
try {
  symlinkSync(join(root, "node_modules"), dependencies, "junction");
} catch (error) {
  if (error.code !== "EEXIST" || realpathSync(dependencies) !== realpathSync(join(root, "node_modules"))) throw error;
}

function replace(file, replacements) {
  const path = join(destination, file);
  let text = readFileSync(path, "utf8");
  for (const [original, updated] of replacements) {
    if (!text.includes(original)) throw new Error(`Could not find ${original} in ${file}`);
    text = text.replaceAll(original, updated);
  }
  writeFileSync(path, text);
}

replace("ios/App/App.xcodeproj/project.pbxproj", [
  [`PRODUCT_BUNDLE_IDENTIFIER = ${appId};`, `PRODUCT_BUNDLE_IDENTIFIER = ${devId};`],
]);
replace("ios/App/App/Info.plist", [[`<string>${appName}</string>`, `<string>${devName}</string>`]]);
replace("android/app/build.gradle", [[`applicationId "${appId}"`, `applicationId "${devId}"`]]);
replace("android/app/src/main/res/values/strings.xml", [[appName, devName], [appId, devId]]);

copyFileSync(join(root, "package.json"), join(destination, "package.json"));
writeFileSync(join(destination, "capacitor.config.json"),
  JSON.stringify({ appId: devId, appName: devName, webDir: "web" }, null, 2) + "\n");
execFileSync(process.execPath, [join(root, "node_modules/@capacitor/cli/bin/capacitor"), "sync"],
  { cwd: destination, stdio: "inherit" });
