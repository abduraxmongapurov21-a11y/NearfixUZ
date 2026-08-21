# NearFIX Backend

System foundation for the NearFIX managed operational service marketplace.

This backend is the future source of truth for:

- phone-based MVP auth
- role/session invalidation
- users and worker profiles
- worker availability
- order state machine
- operational order events

## Stack

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma

## Local setup

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run dev
```

`DATABASE_URL` and `DIRECT_URL` must both point to PostgreSQL before running migrations.

## Pixel_7 local runtime

The checked-in examples isolate the Android emulator from production:

```text
Pixel_7 → http://10.0.2.2:4000 → PostgreSQL on 127.0.0.1:5432
```

Copy `backend/.env.example` to the ignored `backend/.env`, use development-only secrets, and verify the
sanitized database host before applying migrations. Then run `prisma migrate deploy` and
`npm run local-runtime:prepare`. The local runtime fixture refuses non-loopback databases and non-development/test
environments.
