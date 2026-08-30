# NearFIX App Review Notes

Copy this document into App Store Connect Review Notes for the NearFIX 1.0.3 review build. Replace credential placeholders directly in App Store Connect from the approved secret source; never store the values in Git.

## Production services

- Mobile backend: https://nearfix-production-backend-wvd6v.ondigitalocean.app
- Privacy Policy: https://nearfix-production-backend-wvd6v.ondigitalocean.app/legal/privacy
- Terms / Public Offer: https://nearfix-production-backend-wvd6v.ondigitalocean.app/legal/terms
- Account deletion information: https://nearfix-production-backend-wvd6v.ondigitalocean.app/legal/account-deletion
- An admin portal is not required for mobile App Review.

## Reviewer credentials

- Demo client phone: `<ENTER_SECURELY_IN_APP_STORE_CONNECT>`
- Demo client password: `<ENTER_SECURELY_IN_APP_STORE_CONNECT>`
- Demo worker phone: `<ENTER_SECURELY_IN_APP_STORE_CONNECT>`
- Demo worker password: `<ENTER_SECURELY_IN_APP_STORE_CONNECT>`

## Authentication

- Login uses phone and password only for the two allowlisted reviewer accounts.
- Normal production users continue to use OTP authentication.
- The reviewer accounts do not require SMS access.
- There is no universal OTP code or general production password-login route.

## Client test flow

1. Open NearFIX and continue to the login screen.
2. Enter the dedicated demo client credentials.
3. Tap **Kirish**.
4. Browse the catalog and open the App Review worker profile.
5. Use the preloaded saved address or select a one-time map location to create an order.
6. Inspect order details and the order chat.
7. The isolated account includes completed and cancelled demonstration orders plus a sample rating.

## Worker test flow

1. Sign out from the client account.
2. Enter the dedicated demo worker credentials.
3. Tap **Kirish**.
4. The approved demo worker account opens the worker dashboard directly.
5. Switch to client mode and back to worker mode if desired.
6. Review assigned jobs, chat, profile management, and worker support.

## Payments

Payments are disabled for this review build. No payment information or purchase is required.

## Safety and moderation

- Users can report workers, reviews, chat messages, and order problems.
- Users can block another user and manage blocked users from Profile.
- Client and worker support requests are available in-app.
- Reports, support tickets, reviews, workers, and user suspension are moderated by NearFIX operations.
