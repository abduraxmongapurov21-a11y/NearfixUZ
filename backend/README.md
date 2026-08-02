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

`DATABASE_URL` must point to PostgreSQL before running `db:push` or migrations.
