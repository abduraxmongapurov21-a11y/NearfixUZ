# Analog Messenger

Expo + React Native messenger MVP for iOS and Android, with an Express + PostgreSQL API.

## Authentication modes

Eskiz OTP integration is intentionally deferred. Phone find-or-create login is
available only when `NODE_ENV=development` (or `test`) and
`DEVELOPMENT_AUTH_ENABLED=true`. It is disabled by default. The API refuses to
start when `NODE_ENV=production` and development authentication is enabled.

New development users are stored with `displayName=null`, `username=null`, and
`avatarUrl=null`; the mobile app transparently displays the normalized phone
number and phone-derived initials until real profile data is populated. It does
not generate a name or join the user to local identity fixtures.

Access tokens are short-lived JWTs; refresh tokens are rotated and stored only
as hashes in PostgreSQL. The mobile app keeps tokens in Expo SecureStore and
restores the session when the app starts. Direct conversations and messages are
persisted in PostgreSQL and synchronized over authenticated WebSockets.

## Install and verify

```bash
npm install
npm run api:prisma:generate
npm run typecheck
npm test
```

## Local backend

```powershell
docker compose up -d postgres
Copy-Item apps/api/.env.example apps/api/.env
npm run api:prisma:migrate
npm run api:dev
```

In another terminal:

```bash
npm run mobile:start
```

Android Emulator uses `http://10.0.2.2:4000` by default; iOS Simulator uses
`http://localhost:4000`. For a physical phone, copy
`apps/mobile/.env.example` to `apps/mobile/.env`, set the computer's LAN IP, and
explicitly enable development authentication in `apps/api/.env`. Production
exports require an explicit HTTPS `EXPO_PUBLIC_API_URL`; localhost and insecure
HTTP fallbacks are rejected outside development.

## Implemented

- Typed root stack and Chatlar, Kontaktlar, Sozlamalar bottom tabs
- Chat list search and direct-message filters
- Authenticated backend user discovery by exact normalized phone, display-name prefix, or username prefix
- Duplicate-safe Contacts to Direct Chat flow
- Central typed conversation and message state
- Conversation view, empty-message state, and local message composer
- PostgreSQL + Prisma `User` and revocable `Session` models
- Phone find-or-create login, JWT access token and rotating refresh token
- Secure mobile token storage, startup session restore and logout
- Transaction-safe direct-conversation uniqueness in PostgreSQL
- Persistent cursor-paginated messages with idempotent client message IDs
- Authenticated `message.created` WebSocket delivery and reconnect synchronization
- Real PostgreSQL peer identity fields: nullable display name, username, and avatar URL
- Explicit stale/offline retry states without demo fallbacks

## Messaging API

All REST endpoints require `Authorization: Bearer <accessToken>`.

- `GET /v1/users/discover?q=<query>&limit=10` — exact normalized phone lookup or limited display-name/username prefix search. Returns `{ users }`, excludes the caller, never creates users, and caps `limit` at 20.
- `POST /v1/conversations/direct` — body `{ "participantPhoneNumber": "+998..." }`; returns `{ conversation }`, creating it or returning the unique existing direct conversation.
- `GET /v1/conversations` — returns `{ conversations }` for the authenticated member.
- `GET /v1/conversations/:id/messages?limit=30&cursor=<opaque>` — returns chronological `{ items, nextCursor }`; the cursor requests the next older page.
- `POST /v1/conversations/:id/messages` — body `{ "clientMessageId": "...", "body": "..." }`; returns `{ message, created }`. Reusing the same client ID and body returns the original message.

Connect to `/v1/ws`, then immediately send:

```json
{ "type": "auth", "accessToken": "..." }
```

The server responds with `auth.ok`. Conversation members receive:

```json
{ "type": "message.created", "message": { "id": "...", "conversationId": "..." } }
```

Invalid, expired, or revoked sessions are closed with WebSocket code `4401`.

User objects exposed by auth, discovery, and conversation peer responses contain
only `id`, normalized `phoneNumber`, nullable `displayName`, nullable `username`,
nullable `avatarUrl`, and (for the authenticated user only) `createdAt`.
