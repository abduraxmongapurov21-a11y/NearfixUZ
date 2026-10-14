# NearFIX mobile store release

## Release identity

- Marketing version: **1.0.7** (owner confirmed the latest store version is 1.0.6 on 2026-10-14).
- App name: `NearFIX`; iOS bundle and Android application ID: `uz.nearfix.app`.
- Existing EAS project: `@oybekdev/nearfix-mobile`, `cb752bd0-f6d9-4240-9215-7193ac16755a`.
- App Store Connect app ID: `6782775201`.
- Production API: `https://nearfix-production-backend-wvd6v.ondigitalocean.app`.
- Public pages on that origin: `/legal/privacy`, `/legal/terms`, `/legal/account-deletion`.

This checkout contains uncommitted application fixes. The store preparation report and archive manifest are in `artifacts/store-prep-2026-10-14/`. A passing JavaScript export is not a signed native AAB/IPA or a device test.

## Environment and credentials

EAS login/project access and the presence of `YANDEX_MAPKIT_API_KEY` in the production EAS environment were verified on 2026-10-14. Do not initialize a replacement EAS project.

- Keep a valid Yandex **MapKit SDK** key in local `.env.local` and in EAS `production`. The native key is embedded in the app; apply provider restrictions for the supported app identifiers. It is distinct from a server Geocoder key.
- `google-services.json` is the tracked public Firebase Android app configuration and must be included in the build archive. It is **not** a service-account key. An EAS file variable named `GOOGLE_SERVICES_JSON` can override its path. Never put server credentials in that file.
- Backend `PUBLIC_SUPPORT_EMAIL` defaults to **possibleuz@gmail.com**, verified from the existing NearFIX Google Play listing on 2026-10-14 and selected by the owner. A deployment variable can override it. Confirm the deployed email route and monitor this inbox.
- Apple distribution signing, provisioning and push credentials must be verified with the owner's Apple Developer team. Google Play uploads must use the existing app's upload key. An old successful Android build does not verify this candidate's signing or store version counters.
- A Google Play service-account credential is needed for automated EAS Submit. Manual Play Console upload is an alternative. Store those credentials in the credential service, never Git or the app bundle.

The release commands load the production profile and local dotenv values into the parent process before EAS resolves Expo config. Only variable presence, not values, is printed by preflight.

## Toolchain and native projects

- EAS CLI: **24.13.0**, pinned in `eas.json` and used by the release wrapper.
- Expo SDK 54 / React Native 0.81; Android compile/target SDK **36**, min SDK 26.
- Android EAS image: `ubuntu-24.04-jdk-17-ndk-r27b`.
- iOS EAS image: `macos-sequoia-15.6-xcode-26.0`.
- `expo-system-ui` supplies the configured Android light theme.

NearFIX uses Expo Continuous Native Generation. `android/` and `ios/` are generated from app config, plugins and the lockfile; they remain excluded from EAS uploads. Backend, admin, test artifacts, `.env` files and private signing files are also excluded. EAS generates clean native projects for builds. Do not upload an old generated native folder in place of the current app config.

The pinned images are listed in [Expo's build infrastructure documentation](https://docs.expo.dev/build-reference/infrastructure/). Apple requires Xcode 26 and the iOS 26 SDK for current submissions; see [Apple's requirements](https://developer.apple.com/news/upcoming-requirements/). Check [Google Play's target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) at submission time. Verify native libraries in the resulting AAB for [16 KB page support](https://developer.android.com/guide/practices/page-sizes); JavaScript export cannot establish native binary compliance.

## Local release checks

```powershell
npm ci
npm run release:preflight
npm run release:verify
node scripts/run-local-audit.mjs
```

`release:verify` runs production config checks, localization, focused auth/location/order-state checks, ESLint, Expo Doctor, Android/iOS Hermes exports, asset/identifier checks and a scan for production URLs and local-network URLs. It replaces its generated `dist-test-store` directory; preserve any needed previous export first. Root audit tests are synthetic/state/source-contract tests, not native device tests.

For backend changes:

```powershell
npm --prefix backend ci
npm --prefix backend run check
npm --prefix backend run test:legal-routes
```

Set a valid `PUBLIC_SUPPORT_EMAIL` when checking the positive public email/deletion path. The legal-route test uses its guarded disposable local database harness. Do not point test scripts at production databases.

## Production builds and uploads

```powershell
npm run release:build:android
npm run release:build:ios
# Or: npm run release:build
```

These commands start cloud builds and can consume EAS quota. Android output is an `.aab`; iOS output is an App Store `.ipa`. EAS manages and increments remote `versionCode` and `buildNumber`. Before the first new upload, compare EAS remote counters with the highest numbers already used in each store, including TestFlight/internal tracks. The local numeric fields are not authoritative when `appVersionSource` is `remote`.

After reviewing the exact completed build and its device test results, explicitly submit its build ID:

```powershell
npm run release:submit:android -- --id <ANDROID_EAS_BUILD_ID>
npm run release:submit:ios -- --id <IOS_EAS_BUILD_ID>
```

Android submission is configured for the internal track as a draft. iOS submission uploads to App Store Connect/TestFlight. Promotion and App Review submission remain separate actions. The build command does not automatically submit.

## Backend rollout and recovery

Before exposing the release, verify which migrations the production database has applied. The banner migration `20261008000000_banner_placements_media` adds enums, defaulted columns and an index; do not assume it is already deployed.

1. Record the current deployment revision and database restore point. Verify backup availability and the operator's restore procedure.
2. Apply pending migrations with the project's deployment process (`prisma migrate deploy`) before deploying code that queries the added banner columns. Never run a test reset or development seed on production.
3. Deploy the reviewed backend/admin fixes and set `PUBLIC_SUPPORT_EMAIL` in the backend environment. Confirm health, legal page email links, admin login and banner reads/writes against the intended target.
4. Verify OTP delivery, storage, map configuration and push delivery; observe server errors during internal testing.
5. On application regression, restore the prior compatible backend/admin deployment and stop mobile promotion. Keep the additive banner columns/index during rollback. Do not drop data to reverse a migration; use a reviewed forward fix or the recorded restore procedure if data recovery is necessary.

No production deployment, migration or restore was performed during local preparation.

## Owner and store-console checks

- Confirm **possibleuz@gmail.com** is monitored and the deployed public deletion page exposes it. Google allows a customer support/email route; see [account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
- Confirm Apple/Google signing and upload access; authenticate personally if 2FA is required. Do not send passwords in chat.
- Complete privacy, data safety, age/content, advertising and encryption declarations based on actual runtime behavior and all SDKs. See `docs/store-submission-1.0.7.md` for the evidence-based draft inventory; owner review is still required.
- Capture current phone screenshots and required iPad screenshots (`supportsTablet: true`). Do not reuse unrelated or mock release screens.
- Populate reviewer credentials securely using `docs/app-review-notes-template.md`; ensure the dedicated accounts and sample data actually work in the review environment.
- Test the signed release on real Android/iPhone devices: OTP, worker application, order create/cancel/complete, chat/media, location permission denial and map rendering, push in foreground/background/cold start, account deletion and legal links. Test the supported iPad layout.
- Confirm AAB 16 KB native compatibility and App Store processing warnings against these exact build IDs before promotion.
