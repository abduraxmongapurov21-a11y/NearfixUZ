# NearFIX Admin Web Panel

Desktop-first operational control center for the NearFIX managed service marketplace.

This app is intentionally separate from the Expo mobile app. It is a lightweight operations panel, not a CRM, ERP, analytics SaaS, or dispatch system.

## Stack

- Next.js App Router
- TypeScript
- TailwindCSS
- shadcn/ui-style primitives
- Zustand
- TanStack Query
- TanStack Table

## Development

```bash
npm install
npm run dev
```

## Production deployment contract

For DigitalOcean App Platform, configure:

```text
Root directory: admin-web
Build command: npm run build
Run command: npm start
Production hostname: https://nearfix-admin-k8mxo.ondigitalocean.app
NEXT_PUBLIC_API_URL: https://nearfix-production-backend-wvd6v.ondigitalocean.app
```

Set `NEXT_PUBLIC_API_URL` at build time to the canonical production API hostname. The API target must remain
environment-driven; application code reads `NEXT_PUBLIC_API_URL`. The DigitalOcean starter URLs above
are the canonical production URLs selected by the owner; no purchased custom domain is required.
