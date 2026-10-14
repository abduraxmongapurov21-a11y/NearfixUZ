# NearFIX 1.0.7 store submission preparation

This is a draft worksheet for the owner, not a completed store declaration. Local source checks cannot establish every SDK's data processing, production retention or actual store account settings.

## Data inventory for owner review

| Data in application flows | Purpose and relevant source |
| --- | --- |
| Phone, name, user ID and role | Authentication, profile, worker/client identity; `backend/src/modules/auth/` and `users/` |
| Saved address, order address and coordinates; permission-based device location | Finding nearby services, map selection and service delivery; `src/services/location/`, `addresses/`, `orders/` |
| Profile/worker details, uploaded images, chat, support requests and reports | Service matching, communication, moderation and support; backend worker/media/chat/support/report modules |
| Order history and reviews | Service fulfillment, reputation and dispute handling; backend order/review modules |
| Push token and device platform | Order/chat notifications; `backend/src/modules/notifications/` |
| Authentication and operational audit records | Security, abuse prevention and administrative accountability |

Review whether each category is collected, linked to identity, shared, optional and retained using Apple/Google's definitions. Check Yandex MapKit, Expo push, APNs/FCM, Eskiz, Cloudflare R2 and DigitalOcean practices/configuration. App banners exist: determine the correct advertising declaration from their actual sponsored content. Lack of an ad-tracking SDK alone does not mean the app contains no advertising. Payments are disabled in the production profile.

## Account deletion and support

The backend accepts `PUBLIC_SUPPORT_EMAIL` and renders a mail link on public legal pages. Its default is **possibleuz@gmail.com**, verified from the existing NearFIX Google Play listing on 2026-10-14 and selected by the owner. Confirm `/legal/account-deletion#request-deletion` is accessible without login after deployment. The route asks for the registered phone number and explains ownership verification; it must not collect passwords or OTP codes by email.

The live Google Play listing was observed to say **No data collected** on 2026-10-14. This conflicts with the source inventory above and must be reconciled in Play Console before the next submission; this document does not attest that the console declaration has been updated.

Assign an operator to process requests and document response/retention practices. In-app deletion removes active credentials/tokens/addresses and anonymizes identity; operational order/chat/review records may remain. Confirm the public policy accurately describes actual retained content and deletion handling before answering console questions. See `docs/account-deletion-policy.md` for the application's current deletion contract.

## Exact release acceptance record

Record each native build ID, version, build number, SHA-256, signing team/key identity and the backend deployment revision tested. Attach screenshots and test observations from that same build.

| Gate | Required observation |
| --- | --- |
| Authentication | Register with real OTP; wrong/expired OTP rejected; sign out and sign in; dedicated reviewer account works |
| Worker role | Apply, validate required fields, admin approve/reject, switch client/worker mode |
| Orders | Create, accept, start, complete and cancel in allowed states; stale actions rejected; correct client/worker isolation |
| Chat and media | Send/receive text and camera/gallery image; deny permissions; retry network failure; report/block content |
| Location | First-run permission allow/deny, GPS off, manual address, Yandex map rendering and return navigation |
| Push | Foreground, background and terminated app; correct order/chat navigation and logout isolation |
| Banners | Home/category placements, image/video, active dates, valid destination; create/update/delete through permitted admin roles |
| Admin | Create admin with permitted role, password change, permissions, disabled account, support/report moderation |
| Privacy | In-app deletion, active-order warning, session invalidation, external email request and all public links |
| Devices | Android and iPhone release builds; supported iPad; Android 16 KB native-library check |

The October 13 isolated integration and state tests provide regression evidence, but do not replace these signed-device checks or prove production migration status.

## Submission assets and operations

- App title/descriptions, category, support URL/email, privacy URL and external deletion URL.
- Required screenshots from the actual current phone/iPad interfaces.
- Dedicated reviewer credentials and safe demo data, entered in store consoles rather than source control.
- Reviewed privacy/data-safety, age/content, advertising, permissions and encryption answers.
- A named release operator, production backup/restore point, monitored health/errors/OTP/push and a rollback deployment revision.
- Internal testing first, then deliberate store promotion. No production publication is implied by this worksheet.
