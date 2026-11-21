# Phase 1 progress

Implemented locally on `feat/shared-timer-engine-native-dev`, based on `feat/timer-sessions`.

## Current Dashboard flow

The follow-up removed the temporary **Try the new timers** area and connected the shared engine to the existing **+** picker on web and both native builds. The picker now has **Date Countdown**, **Countdown Timer**, **Interval Timer**, and **World Clock**. Add a timer with **+**, enter its settings, select **Add**, and select **Start** on the card that appears on the selected Dashboard. The Countdown Timer uses the existing Duration Countdown slot. The Interval Timer uses the existing Interval Timer slot with separate minutes and seconds, optional rest, and an advanced preparation setting.

Existing Duration and finite Interval cards retain their names, Dashboard placement, remaining time or deadline, and repetition position. They use the shared engine when operated. Legacy manual pause statistics were unavailable in saved cards. The standalone PWA and linked timers still use their existing routes.

The follow-up passed all 33 unit tests, including both saved-card compatibility checks. The Chromium preview verified the picker, multiple timers on a named Dashboard, older saved cards, and offline PWA reload. Both native development apps built and added and ran a countdown through the picker in their WebViews. Manual iOS touch interaction remains unverified.

When the local one-off smoke scripts from this session are available, run the follow-up browser check with `node /tmp/timeandate-dashboard-shared-picker-smoke.mjs`. The native picker checks used `sh /tmp/timeandate-picker-ios-build.sh smoke` and `node /tmp/timeandate-android-picker-smoke.mjs` with the same ADB forwarding as the initial Android check.

GitHub Actions can build debug QA artifacts for both native app targets. The signed workflow packages Time And Date for store QA and production. Android release packaging and signing passed locally with a temporary key. GitHub-hosted signed builds and iOS signing still need the configured signing environments and credentials. See [Mobile builds](../../mobile.md).

The initial demonstration and its original verification are recorded below. Follow the current Dashboard flow above when running the new build.

## Initial Phase 1 milestone

- Dashboard has two milestone timer cards under **Try the new timers**. The section opens by default in the separate native development apps. Each Dashboard keeps its own in-memory Countdown Timer and Interval Timer while the app stays open.
- Both cards use `src/timer-session.js` on all three platforms. It reuses the existing deadline primitives and keeps classification, restart time, and continuous pause/rest accounting in pure functions. The preparation cue is a visible 3-second phase. Preparation and its own holds are excluded from pause totals. When a paused repetition is restarted, the user hold is counted through Resume.
- The milestone Interval Timer starts with 10-second repetitions, 3 repetitions, and 0:02 rest. Both repetition and rest have separate minutes and seconds fields, including 0:00 rest. Numeric limits and defaults are provisional for this milestone.
- The development build generates a second pair of Capacitor projects under `artifacts/timer-dev` with ID `io.github.rahshin.timeandate.timers.dev`. The development setup inherits iOS 15.0 minimum and Android API 24 minimum / API 36 target from the existing projects. These are local development settings.
- Phase 2 continues with the full Dashboard picker and placement flow. Saved presets, history and recovery are Phase 3 work. Speech and screen wake are Phase 4 work.

## Build and run commands

From the repository root:

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1
npm run mobile:sync
npm run timer-dev:sync
```

Open `/dashboard`, expand **Try the new timers**, and select **Start** on a ready card. Select **Set timer** after changing the duration fields. The legacy interval and date/duration routes remain available in the web build. To check standalone offline behavior, load `/interval-timer-app/` through the production preview, wait for service worker control, switch the browser offline, and reload.

The local iOS check used Xcode 27.2 and an iPhone 17 Pro simulator running iOS 26.5. The `-clonedSourcePackagesDirPath` and `-disableAutomaticPackageResolution` flags reuse the machine's existing Capacitor package cache. On a fresh checkout, omit both flags to resolve packages normally.

```sh
sim=547A27F0-1775-4D89-B012-7C04BECCC56A
xcrun simctl boot "$sim"
xcodebuild -project artifacts/timer-dev/ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator -destination "id=$sim" \
  -derivedDataPath artifacts/timer-dev/ios-build \
  -clonedSourcePackagesDirPath /private/tmp/timeandate-ios-build/SourcePackages \
  -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
xcrun simctl install "$sim" artifacts/timer-dev/ios-build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$sim" io.github.rahshin.timeandate.timers.dev
```

For the existing iOS app regression, use the same `xcodebuild` command with `-project ios/App/App.xcodeproj` and `-derivedDataPath artifacts/legacy-ios-check`.

The local Android check used a Pixel 9a emulator and Java 21. Omit `--offline` if the Gradle cache needs populating.

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
"$ANDROID_HOME/emulator/emulator" -avd Pixel_9a -no-window -no-snapshot-save
```

From a separate terminal with the same Java and Android settings:

```sh
(cd artifacts/timer-dev/android && sh ./gradlew --offline :app:assembleDebug)
"$ANDROID_HOME/platform-tools/adb" install -r artifacts/timer-dev/android/app/build/outputs/apk/debug/app-debug.apk
"$ANDROID_HOME/platform-tools/adb" shell am start -n io.github.rahshin.timeandate.timers.dev/io.github.rahshin.timeandate.MainActivity
(cd android && sh ./gradlew --offline :app:assembleDebug :app:testDebugUnitTest)
```

## Verified on November 20, 2026

| Check | Result |
| --- | --- |
| Shared engine and existing unit tests | 31 passed, including 10 fake-clock tests for phase boundaries, paused controls, zero rest, statistics, and independent sessions |
| Web preview | Opened Dashboard, ran the two timers together, paused and reset Countdown, observed completion, and exercised Interval Skip, Skip rest, and Stop |
| Legacy web and native | Existing web picker and timer routes, legacy Capacitor picker, legacy iOS and Android debug builds, and Android unit tests passed |
| Standalone PWA | Reloaded offline under service-worker control. The standalone and embedded legacy Interval Timer settings and completion also passed |
| iOS dev | Built and installed on iPhone 17 Pro. Dashboard rendered and a one-second countdown reached Complete in the simulator WKWebView using a temporary test harness. Rebuilt and reinstalled the clean app afterward |
| Android dev | Built and installed on Pixel 9a. Dashboard opened and a one-second countdown reached Complete through the debug WebView |
| Shared assets | The timer development JavaScript bundle had the same SHA-256 in the Vite output, iOS app, and Android APK |

Artifacts:

- Web preview output at `dist/`.
- iOS simulator app at `artifacts/timer-dev/ios-build/Build/Products/Debug-iphonesimulator/App.app`.
- Android debug APK at `artifacts/timer-dev/android/app/build/outputs/apk/debug/app-debug.apk`.

Local automation commands for this run were `node /tmp/timeandate-timer-sessions-smoke.mjs`, `node /tmp/timeandate-legacy-interval-settings-smoke.mjs`, and `node /tmp/timeandate-android-session-smoke.mjs` (with the Android debug WebView forwarded to port 4923 using ADB). The shell and Swift harnesses for the iOS run are in `/tmp/timeandate-phase-ios-build.sh` and `/tmp/timeandate-ios-smoke-extension.swift`.

The host could boot the iOS simulator through `simctl` but could not open a Simulator GUI. Manual iOS touch interaction remains unverified. The countdown and Dashboard checks ran in the iOS simulator, and the clean app was relaunched and inspected after the harness was removed.

## Phase 2 Dashboard integration · 2026-11-20

Local branch `feat/dashboard-timer-integration` starts at `7b8f6ff`, the updated `origin/main` after PR #3 merged.

- Interval Timer **Advanced** now saves **Final-seconds countdown** and its window through creation and editing. The toggle defaults off and the window defaults to 10 seconds. The window accepts 1–59,999 whole seconds, up to the maximum repetition duration. A saved window is retained when the toggle is off. Existing cards without these fields open with the defaults. Foreground speech and screen wake are Phase 4 work.
- Retained the existing limits and defaults where the handoff left them open. Interval Timer defaults to 0:10 activity, 3 repetitions and 0:02 rest. Activity is 0:01–999:59, rest is 0:00–999:59, and repetitions are 1–999. Preparation defaults off and uses 3 seconds when enabled. Countdown Timer defaults to 00:10:00 and accepts 00:00:01–999:59:59.
- Chrome, Android WebView and iOS WKWebView verified named dashboard creation and switching, saving a default, adding all four item types on the selected board, ready states, card editing, mute, timer controls and narrow viewport layout. Chrome also verified Enter and Tab navigation, legacy route loading, older saved cards, and offline reload of the standalone Interval Timer PWA. Android UI Automator exposed the picker label and an injected emulator touch opened the picker. On iOS, WebView automation verified the labels and layout. Manual Simulator touch and screen-reader interaction remain unverified.
- Mobile CI now builds both app targets on pull requests and pushes to `main` or `release/**`, publishing two debug APKs and two simulator ZIPs as GitHub Actions artifacts. Manual dispatch still builds the selected target. The signed workflow remains available on demand. GitHub-hosted execution and upload are pending a remote run. The branch remains local.

### Verification commands

Run from the repository root. The smoke scripts and logs under `/tmp` are local session files.

```sh
npm test
npm run build
npm run timer-dev:sync
npm run mobile:sync
/tmp/primora-actionlint -color
node /tmp/timeandate-phase2-web.mjs

export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export ANDROID_HOME="$HOME/Library/Android/sdk"
(cd artifacts/timer-dev/android && sh ./gradlew --offline :app:assembleDebug)
(cd android && sh ./gradlew --offline :app:assembleDebug)
adb="$ANDROID_HOME/platform-tools/adb"
app_id=io.github.rahshin.timeandate.timers.dev
"$adb" install -r artifacts/timer-dev/android/app/build/outputs/apk/debug/app-debug.apk
"$adb" shell am force-stop "$app_id"
"$adb" shell am start -n "$app_id/io.github.rahshin.timeandate.MainActivity"
"$adb" forward tcp:4923 "localabstract:webview_devtools_remote_$("$adb" shell pidof "$app_id" | tr -d '\r')"
node /tmp/timeandate-phase2-android.mjs

sh /tmp/timeandate-phase2-ios.sh smoke
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -configuration Debug \
  -derivedDataPath artifacts/phase2-existing-ios \
  -clonedSourcePackagesDirPath /private/tmp/timeandate-ios-build/SourcePackages \
  -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
```

All 34 tests passed. The iOS smoke runner restores the generated project and rebuilds the normal app after testing. Local build artifacts:

| Target | Artifact |
| --- | --- |
| Web and standalone PWA | `dist/`, including `dist/interval-timer-app/` |
| Timers Dev Android | `artifacts/timer-dev/android/app/build/outputs/apk/debug/app-debug.apk` |
| Timers Dev iOS | `artifacts/phase2/timers-dev-ios-simulator.zip` |
| Existing Capacitor Android | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Existing Capacitor iOS | `artifacts/phase2/timeandate-ios-simulator.zip` |

### Bookmarkable dashboards

Each dashboard name is a link to `/dashboard?board=<id>`. Open it in a new tab or window, or bookmark it using the browser. The ID resolves against dashboards saved in the current browser profile. `/dashboard` still opens the default. A missing or deleted ID falls back to the default. Add, edit, and cancel routes keep the selected board.

Verified with `npm test` (34 passed), `npm run build`, `npm run mobile:build`, `npm run timer-dev:sync`, and `node /tmp/timeandate-dashboard-bookmarks.mjs`. The Chrome preview check covered two tabs with distinct boards, default changes, card placement, add and edit navigation, reload, browser Back, and fallback for an unknown board ID.
