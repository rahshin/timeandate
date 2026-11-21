# Mobile builds

| Target | Sync command | App ID | Use |
| --- | --- | --- | --- |
| Time And Date | `npm run mobile:sync` | `io.github.rahshin.timeandate` | Local builds, GitHub Actions QA, and manual store builds |
| Time And Date Timers Dev | `npm run timer-dev:sync` | `io.github.rahshin.timeandate.timers.dev` | Local builds and GitHub Actions debug QA alongside Time And Date |

Both native targets are Dashboard-only and offer Date Countdown, Countdown Timer, Interval Timer, and World Clock through the Dashboard picker. The standalone Interval Timer PWA at `/interval-timer-app/` ships with the web release.

## Set up and run locally

Use Node 24, as in CI. For Android, install Android Studio, JDK 21, and Android SDK Platform 36. Set `JAVA_HOME` and `ANDROID_HOME` if Gradle or the terminal cannot find them. For iOS, use macOS with Xcode and an installed iOS Simulator runtime.

From the repository root:

```sh
npm ci
npm test
npm run mobile:sync
```

Run the sync command after changing web code. It builds `dist-native/` and copies the assets into both Capacitor projects. To sync one platform, use `npm run mobile:sync -- android` or `npm run mobile:sync -- ios`.

- **Android** — Run `npm run mobile:android`, select an emulator or a USB-debugging-enabled device in Android Studio, and run the `app` configuration.
- **iOS** — Run `npm run mobile:ios`, select an iOS simulator in Xcode, and run the `App` scheme. For a physical iPhone, select a development team for the App target in **Signing & Capabilities** and use a device provisioned for that team. [Apple’s device distribution guide](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices/)

For the separate timer development app, run `npm run timer-dev:sync` and open `artifacts/timer-dev/android/` in Android Studio or `artifacts/timer-dev/ios/App/App.xcodeproj` in Xcode. Sync regenerates both projects from the tracked native files. Use **Dashboard → +** to add a timer, then **Start** on its card.

## Build for QA

The **Build mobile apps** workflow runs on pull requests and pushes to `main` or `release/**`. Each run builds both targets and uploads four GitHub Actions artifacts. Download the Android debug APK and iOS simulator ZIP for each target from the completed run. To build one target on demand, go to **Actions → Build mobile apps → Run workflow** and select the branch and target.

To produce the equivalent artifacts locally, run `npm run mobile:sync` first. For the separate timer app, run `npm run timer-dev:sync` and use the alternate project and output paths in the table below.

```sh
(cd android && sh ./gradlew :app:assembleDebug)
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -configuration Debug -derivedDataPath ios-build CODE_SIGNING_ALLOWED=NO build
ditto -c -k --keepParent ios-build/Build/Products/Debug-iphonesimulator/App.app timeandate-ios-simulator.zip
```

| Target | Android project and APK | Xcode project and simulator output |
| --- | --- | --- |
| Time And Date | `android/`, APK at `android/app/build/outputs/apk/debug/app-debug.apk` | `ios/App/App.xcodeproj`, use `-derivedDataPath ios-build` |
| Time And Date Timers Dev | `artifacts/timer-dev/android/`, APK at `artifacts/timer-dev/android/app/build/outputs/apk/debug/app-debug.apk` | `artifacts/timer-dev/ios/App/App.xcodeproj`, use `-derivedDataPath artifacts/timer-dev/ios-build` |

To install the APK or simulator app, start the emulator or simulator first. For a downloaded simulator artifact, extract the ZIP files until you have `App.app` and pass its path to `simctl install`.

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
xcrun simctl install booted ios-build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted io.github.rahshin.timeandate
```

For Timers Dev, substitute the paths from the table and launch `io.github.rahshin.timeandate.timers.dev`. The iOS simulator artifact runs in Simulator. For QA through TestFlight or Google Play on physical devices, use the signed release process below and distribute to testers first.

## Build signed apps for store QA and production

Build from the intended release commit, run `npm ci` and `npm test`, then sync the tracked Capacitor projects. Use [Build signed mobile apps](../.github/workflows/mobile-release.yml) for CI signing, or follow the platform instructions below to sign locally. Store upload and release are manual. The Cloudflare release workflow deploys the website and PWA.

### Android · Google Play

1. Check that `applicationId` in `android/app/build.gradle` matches the Play Console app. Set the release `versionName` and increase `versionCode` from the last uploaded build.
2. Run `npm run mobile:sync -- android` and open the project with `npm run mobile:android`.
3. In Android Studio choose **Build → Generate Signed Bundle / APK**, select **Android App Bundle**, select the registered upload key for this app, and build the `release` variant. Use the signed `.aab` from the output location shown by Android Studio. Keep the signing key and passwords outside the repository. [Android app signing guide](https://developer.android.com/studio/publish/app-signing)
4. Upload the bundle to a testing track in Play Console. After QA approval, use the same tested bundle in the production release and follow the review and rollout steps in Play Console.

### iOS · TestFlight and App Store

1. Confirm that the App target’s bundle identifier matches the App Store Connect app. Select the distribution team in **Signing & Capabilities**, set the release version, and increase the build number in the Xcode App target.
2. Run `npm run mobile:sync -- ios` and open the project with `npm run mobile:ios`. Select the `App` scheme and a generic iOS device destination. Use **Product → Archive** to create a Release `.xcarchive`.
3. In Organizer select the archive, validate it, and choose **Distribute App → TestFlight & App Store** to upload a build eligible for both destinations. Distribute to testers in TestFlight. After QA approval, select the same build in App Store Connect and submit it for App Review. [Apple’s beta and release distribution guide](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/)

The separate Timers Dev target has a development ID. Building it for either store requires approved production app IDs, separate store records, and signing for those IDs. The repository currently generates only its development projects.

### Configure signing in GitHub Actions

[Build signed mobile apps](../.github/workflows/mobile-release.yml) runs the tests and packages the tracked Time And Date app as a signed Android App Bundle and iOS IPA. In the repository, go to **Settings → Environments**, create `mobile-qa` and `mobile-production`, and add the following inputs to each environment. Restrict signing environments to trusted refs. Configure required reviewers for production if available on your GitHub plan. [GitHub environments guide](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

| Name | Where to add it | Value |
| --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Environment secret | Base64-encoded JKS or PKCS#12 keystore containing the Google Play upload key |
| `ANDROID_KEYSTORE_PASSWORD` | Environment secret | Keystore password |
| `ANDROID_KEY_PASSWORD` | Environment secret | Password for the upload key entry |
| `ANDROID_KEY_ALIAS` | Environment variable | Alias of the upload key entry |
| `IOS_CERTIFICATE_BASE64` | Environment secret | Base64-encoded `.p12` export containing the Apple Distribution certificate and its private key |
| `IOS_CERTIFICATE_PASSWORD` | Environment secret | Password set when exporting the `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Environment secret | Base64-encoded App Store distribution `.mobileprovision` for the app and signing team |
| `IOS_TEAM_ID` | Environment variable | Apple Developer team ID |

Use the upload key registered to the Play app. For iOS, export the certificate together with its private key from Keychain Access and obtain the matching App Store distribution profile from the Apple Developer portal. An App Store profile and certificate permit the same build to go through TestFlight and App Review. Keep all signing files and encoded values outside the repository. [GitHub’s Apple signing guide](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)

If you use the GitHub CLI, run these commands from the repository after creating the environment. Substitute the actual local file paths. Repeat for `mobile-production` using its signing inputs.

```sh
signing_environment=mobile-qa
base64 < /path/to/upload.jks | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64 --env "$signing_environment"
base64 < /path/to/distribution.p12 | tr -d '\n' | gh secret set IOS_CERTIFICATE_BASE64 --env "$signing_environment"
base64 < /path/to/app.mobileprovision | tr -d '\n' | gh secret set IOS_PROVISIONING_PROFILE_BASE64 --env "$signing_environment"
```

Set the passwords through **Environment secrets** and the alias and team ID through **Environment variables**. Then run **Actions → Build signed mobile apps → Run workflow**. Select the branch and `mobile-qa` or `mobile-production`. Production builds accept `main` or a `release/*` branch. Before dispatch, set the Android version code and iOS build number in the source as described above. Download the two signed artifacts from the completed run and upload them to the store consoles. After QA in a store testing track, reuse the tested bundle or build for production when possible. A signed build from this workflow does not upload or publish automatically.
