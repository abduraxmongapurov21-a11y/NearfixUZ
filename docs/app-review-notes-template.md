# NearFIX App Review Notes

Copy this document into App Store Connect Review Notes for the NearFIX review build.

## Production services

- Mobile backend: https://nearfix-production-c0db.up.railway.app
- Admin portal: https://adaptable-embrace-production.up.railway.app
- Privacy Policy: https://nearfix-production-c0db.up.railway.app/legal/privacy
- Terms / Public Offer: https://nearfix-production-c0db.up.railway.app/legal/terms

## Reviewer credentials

- Demo client phone: `+998901112233`
- Demo client password: `NearfixReview2026!`
- Demo worker phone: `+998901112244`
- Demo worker password: `NearfixWorker2026!`

## Authentication

- Login uses phone and password only.
- OTP is used only for new account registration and password reset.
- Demo accounts use stable phone/password credentials and do not require SMS access.
- There is no production reviewer OTP bypass or universal OTP code.

## Client test flow

1. Open NearFIX and continue to the login screen.
2. Enter the demo client phone and password above.
3. Tap **Kirish**.
4. Browse workers and open a worker profile.
5. Create an order and inspect its details or chat when available.
6. Reporting, blocking, support and account deletion controls are available from the relevant profile, chat and settings screens.

## Worker test flow

1. Sign out from the client account.
2. Enter the demo worker phone and password above.
3. Tap **Kirish**.
4. The approved demo worker account opens the worker dashboard directly.
5. Review incoming/active jobs, chat, profile management and worker support.

## Payments

Payments are disabled for this review build. No payment information or purchase is required during review.

## Safety and moderation

- Users can report workers, reviews, chat messages and order problems.
- Users can block another user and manage blocked users from Profile.
- Client and worker support requests are available in-app.
- Reports, support tickets, reviews, workers and user suspension are moderated through the production admin portal.
