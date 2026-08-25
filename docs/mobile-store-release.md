# NearFIX mobile store release

## Release identity

- App name: `NearFIX`
- Marketing version: `1.0.1`
- iOS bundle identifier: `uz.nearfix.app`
- Android application ID: `uz.nearfix.app`
- App Store Connect app ID: `6782775201`
- Production API: `https://nearfix-production-c0db.up.railway.app`
- Privacy policy: `https://nearfix-production-c0db.up.railway.app/legal/privacy`
- Terms: `https://nearfix-production-c0db.up.railway.app/legal/terms`
- Account deletion: `https://nearfix-production-c0db.up.railway.app/legal/account-deletion`

## One-time account setup

1. Authenticate and link the repository to the existing Expo project:

   ```powershell
   npx --yes eas-cli@latest login
   npx --yes eas-cli@latest init
   ```

2. Copy the resulting EAS project UUID and create these variables in the EAS `production` environment:

   - `YANDEX_MAPKIT_API_KEY` — an Android/iOS-restricted Yandex MapKit SDK key (sensitive).

   Restrict the Yandex MapKit key to the NearFIX native application identifiers (`uz.nearfix.app`). This is a MapKit SDK key, not a Yandex Geocoder key.

3. Configure store credentials:

   - iOS: Apple Developer distribution credentials and App Store Connect access.
   - Android: create the app in Google Play Console, enable Play App Signing, then upload a Google Service Account JSON key through `eas credentials --platform android`.

Never commit Apple keys, Android keystores or Google Service Account JSON files.

## Native project policy

NearFIX uses Expo Continuous Native Generation. The root `android/` and `ios/` directories are generated from
`app.base.json`, `app.config.js`, Expo config plugins and the package lock, so they stay ignored and are not part of
the release commit. Generate them locally when native debugging is required; EAS generates clean native projects for
store builds. APK/AAB/IPA outputs, local database dumps and `backend/uploads/` are local artifacts and must not be
committed.

## Local release gate

Run before every store build:

```powershell
npm run release:verify
```

It runs ESLint, Expo Doctor, creates Android and iOS production bundles, checks store assets and identifiers, confirms all public legal URLs are embedded, and rejects localhost/private-network URLs.

Backend checks required after changing legal pages:

```powershell
npm --prefix backend run check
npm --prefix backend run test:legal-routes
```

## Build

Both platforms:

```powershell
npm run release:build
```

Or separately:

```powershell
npm run release:build:android
npm run release:build:ios
```

The Android production profile generates an `.aab`; the iOS profile generates an App Store `.ipa`. EAS remotely manages and increments `versionCode` and `buildNumber` to avoid duplicate upload versions.

## Upload

```powershell
npm run release:submit:android
npm run release:submit:ios
```

Android is submitted to the internal track as a draft. Promote it in Play Console only after internal testing. iOS is uploaded to App Store Connect/TestFlight and must still be selected and submitted for App Review.

## Store-console checklist

- Add a working public support email. This is not stored in the repository and must be configured in both store listings before submission.
- Upload phone screenshots for both platforms; because iPad support is enabled, also upload required iPad screenshots in App Store Connect.
- Complete Apple App Privacy and Google Play Data safety forms based on the privacy policy.
- In Google Play, use the public account-deletion URL above.
- Declare that the app uses location, camera/photos, push notifications and user-generated chat/profile content.
- Declare that payments are currently disabled and that the app does not use advertising tracking.
- Provide App Review with the demo accounts and workflow from `docs/app-review-notes-template.md`.
- Test OTP, password login/reset, map rendering, photo upload, push notifications, account deletion, legal links, order flow and chat on real release builds.

## Known external prerequisites

The repository cannot supply or validate these without the owner accounts: Expo/EAS project access, Apple signing access, Google Play Developer access, the Google Service Account key, the production Yandex MapKit key, store screenshots and the public support email.
