# Mobile builds

The tracked Capacitor projects use bundle ID `io.github.rahshin.timeandate`. Build and sync the web assets before opening the platform IDE.

```sh
npm ci
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

- **Android** requires Android Studio or the Android SDK with API 36, and JDK 21. Use Android Studio to run on a device or emulator, or run `cd android && ./gradlew assembleDebug` to produce a debug APK.
- **iOS** requires macOS and Xcode. Open the app in Xcode and run it in a simulator. Physical device, TestFlight, and App Store builds require Apple signing and provisioning.
- In GitHub, **Actions → Build mobile apps** produces a debug APK and a zipped iOS Simulator app. Store signing and publishing are separate.

[Capacitor native setup](https://capacitorjs.com/docs/getting-started)
