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

## Production deployment contract

The backend is portable across Node hosting platforms and uses environment variables for PostgreSQL, the listening
port, Cloudflare R2 and Eskiz. For DigitalOcean App Platform, configure:

```text
Root directory: backend
Build command: npm run prisma:generate && npm run build
Run command: npm start
Pre-deploy job: npx prisma migrate deploy
Health check: /health
```

Run the migration as a separate blocking `PRE_DEPLOY` job, not as part of the web service start command. Keep
`DATABASE_URL` and `DIRECT_URL` environment-driven; do not commit connection strings.

## Pixel_7 local runtime

The checked-in examples isolate the Android emulator from production:

```text
Pixel_7 → http://10.0.2.2:4000 → PostgreSQL on 127.0.0.1:5432
```

Copy `backend/.env.example` to the ignored `backend/.env`, use development-only secrets, and verify the
sanitized database host before applying migrations. Then run `prisma migrate deploy` and
`npm run local-runtime:prepare`. The local runtime fixture refuses non-loopback databases and non-development/test
environments.
