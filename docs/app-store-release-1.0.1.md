# NearFIX 1.0.1 App Store release

## Release identity

- App Store Connect app ID: `6782775201`
- Bundle identifier: `uz.nearfix.app`
- Marketing version: `1.0.1`
- Initial build number: `2026072601`
- Production API: `https://nearfix-production-c0db.up.railway.app`

## Verified locally

Run the shared Android/iOS release gate before every upload:

```powershell
npm run release:verify
```

The gate runs ESLint and Expo Doctor, creates Android and iOS production exports, validates store assets and confirms that no localhost or private-LAN URL is embedded.

See `docs/mobile-store-release.md` for the complete Android/iOS build, credential and store-console checklist.

## Build and upload

Authenticate once on the release machine:

```powershell
npx --yes eas-cli@latest login
```

If EAS asks to link or create the Expo project, select the existing NearFIX project owned by the release account. Then build the App Store binary:

```powershell
npm run release:build:ios
```

After the build succeeds, upload the latest production build to App Store Connect/TestFlight:

```powershell
npm run release:submit:ios
```

Submission uploads the binary to App Store Connect. In App Store Connect, select the processed build for version 1.0.1, complete the review fields, use `docs/app-review-notes-template.md` for Review Notes, and submit it for App Review.

## Suggested release note

> SMS tasdiqlash va serverga ulanish barqarorligi yaxshilandi.
