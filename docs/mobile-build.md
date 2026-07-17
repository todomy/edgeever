# EdgeEver Mobile Builds

EdgeEver Mobile is built with Expo and React Native. Daily Android test packages are built directly on GitHub Actions, without using EAS Build quota.

## Android Debug APK

The `Build EdgeEver Mobile` workflow runs on GitHub Actions and produces a debug APK artifact.

It runs:

```sh
bun install --frozen-lockfile
bun run typecheck:mobile
cd apps/mobile
bunx expo prebuild --platform android --non-interactive --clean
cd android
./gradlew assembleDebug
```

The APK is uploaded as a GitHub Actions artifact named `edgeever-android-debug-apk`.

## Release Builds

Run the workflow manually to build a signed Android App Bundle. The workflow
uses the following GitHub Actions secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

The resulting artifact is named `edgeever-android-release-aab`. The upload
keystore is only used to prove ownership when uploading bundles; Google Play
App Signing manages the app signing key delivered to users. Keep an encrypted
backup of the upload keystore and its credentials outside the repository.

iOS device builds and App Store submissions require Apple Developer Program enrollment, certificates, and provisioning profiles. Until those credentials are available, iOS can be developed locally with Expo Go or simulator builds, but installable device `.ipa` release automation should wait.

## EAS

The project is linked to Expo/EAS for optional future use, but routine CI builds should use GitHub Actions local Android builds to avoid consuming EAS monthly build quota.
