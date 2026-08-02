# NearFIX App Review Demo Account Setup

Run these steps against the production backend before submitting the mobile build.

## 1. Configure Railway backend variables

```text
APP_REVIEW_CLIENT_PHONE=+998901112233
APP_REVIEW_CLIENT_PASSWORD=NearfixReview2026!
APP_REVIEW_WORKER_PHONE=+998901112244
APP_REVIEW_WORKER_PASSWORD=NearfixWorker2026!
```

Do not configure an App Review OTP bypass. Login uses phone and password only.

## 2. Apply the production migration

```bash
npx prisma migrate deploy
```

Confirm the password-auth migration is applied before preparing accounts.

## 3. Prepare the demo accounts

Run from the backend workspace with production `DATABASE_URL` and the variables above:

```bash
npm run app-review:prepare
```

The script:

- creates or updates the client as an active `CLIENT`;
- creates or updates the worker as an active `PROVIDER`;
- hashes and sets both passwords;
- revokes stale sessions after password changes;
- creates an approved worker profile;
- sets worker availability to `AVAILABLE`;
- clears deleted, blocked and pending-review states that would prevent review access.

## 4. Verify production login

```bash
curl -X POST https://nearfix-production-c0db.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+998901112233","password":"NearfixReview2026!"}'
```

```bash
curl -X POST https://nearfix-production-c0db.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+998901112244","password":"NearfixWorker2026!"}'
```

Expected:

- HTTP `200`;
- client role is `client`;
- worker role is `provider`;
- both responses contain access and refresh tokens;
- neither login requests OTP.

## 5. Final review checks

- Fresh-install the review build.
- Sign in with the client credentials and confirm the client app opens.
- Sign out and sign in with the worker credentials.
- Confirm the approved worker dashboard opens directly.
- Confirm no payment is required.
- Copy `docs/app-review-notes-template.md` into App Store Connect Review Notes.
