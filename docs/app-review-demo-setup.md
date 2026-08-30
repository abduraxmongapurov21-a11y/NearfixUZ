# NearFIX App Review Demo Account Setup

Run these steps against the production backend before submitting the mobile build.

## 1. Configure production backend variables

Configure these variables on the `nearfixuz-backend` DigitalOcean component. Store every credential variable as an encrypted `SECRET` and never copy credential values into source control, tickets, logs, or documentation.

```text
APP_REVIEW_DEMO_ENABLED=true
APP_REVIEW_DEMO_CLIENT_PHONE=<ENCRYPTED_SECRET>
APP_REVIEW_DEMO_CLIENT_PASSWORD=<ENCRYPTED_SECRET>
APP_REVIEW_DEMO_WORKER_PHONE=<ENCRYPTED_SECRET>
APP_REVIEW_DEMO_WORKER_PASSWORD=<ENCRYPTED_SECRET>
```

Do not configure an App Review OTP bypass. Login uses the dedicated phone and password pairs only.

## 2. Apply production migrations

The DigitalOcean pre-deploy job must run:

```bash
npx prisma migrate deploy
```

Confirm the migration job succeeds before preparing accounts.

## 3. Prepare the isolated demo accounts

Run from the production backend container so the encrypted variables and production database binding are supplied by DigitalOcean:

```bash
npm run app-review:prepare
```

The script:

- refuses to modify an existing account unless its role and App Review identity match;
- creates or updates the client as an active `CLIENT`;
- creates or updates the worker as an active `PROVIDER`;
- hashes both passwords and revokes stale sessions;
- creates an approved worker profile and sets it to `AVAILABLE`;
- prints masked identifiers only and never prints passwords.

## 4. Verify production login

Use the active production backend only:

```text
https://nearfix-production-backend-wvd6v.ondigitalocean.app
```

Enter the credential values interactively from the approved secret source. Do not place them in shell history or command output.

Expected:

- HTTP `200` from `/auth/app-review/login`;
- client role is `client` and worker role is `provider`;
- responses contain access and refresh tokens but no password;
- both accounts use the password path and do not request OTP.

## 5. Final review checks

- Fresh-install the review build.
- Sign in with the client credentials and confirm the client app opens.
- Sign out and sign in with the worker credentials.
- Confirm the approved worker dashboard opens directly.
- Confirm no payment is required.
- Enter credentials directly into App Store Connect only when preparing the submission.
- Copy `docs/app-review-notes-template.md` into App Store Connect Review Notes and replace credential placeholders interactively.
