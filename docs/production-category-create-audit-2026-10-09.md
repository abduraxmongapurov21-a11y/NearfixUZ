# Production category creation investigation — 2026-10-09

User report: category creation fails in the deployed admin panel.

## Verified deployment

- Admin app: `cf59bdbc-40bc-407a-b727-89cf58a8814d`, component `nearfixuz-admin-web`, source `main` at `2556dd7d37e8b3de1be406896780e816e38fa28e`. DigitalOcean shows Healthy; latest deployment is October 1.
- Backend app: `86739c34-7866-454f-a70b-58f88150a385`, component `nearfixuz-backend`, same source commit. Its live deployment is `a6db4d8c-eba7-4c33-8b57-d5065338ba07`. Backend autodeploy is Off; admin autodeploy is On. Neither setting was changed.
- Active admin starter domain: https://nearfix-admin-k8mxo.ondigitalocean.app. Its login page returned HTTP 200.
- `https://admin.nearfix.uz` did not resolve in the browser (`ERR_NAME_NOT_RESOLVED`) or Node HTTP probe (`EAI_AGAIN`). DigitalOcean Networking shows this primary custom domain as **Configuring**, with a CNAME setup notice. This is a confirmed separate domain problem; it does not establish the cause of a category POST failure at the working starter domain.
- The deployed login page's public JavaScript chunk `/_next/static/chunks/2clx_zwa_4gbc.js` uses `https://nearfix-production-backend-wvd6v.ondigitalocean.app` as the API base.

## Read-only live API evidence

- `GET /health`: HTTP 200, `ok: true`.
- `GET /content/categories`: HTTP 200, seven active categories: plumbing, electric, welding, repair, ac, renovation, cleaning.
- `OPTIONS /admin/categories` for POST with authorization/content-type headers: HTTP 204 with the matching allow-origin for both the starter admin domain and `https://admin.nearfix.uz`. This confirms the preflight configuration, not a successful authenticated create.
- The loaded production runtime log view showed mobile expired-token warnings on October 6 and October 8. No category-create error appeared in that loaded view. Retention and the loaded range limit this observation; Zod validation failures are also not logged by this source's error handler.
- `doctl apps list` returned 401; cloud observations came from the already authenticated DigitalOcean browser session.

## Source and local verification

`git diff 2556dd7d37e8b3de1be406896780e816e38fa28e -- backend/src/modules/categories admin-web/modules/categories` is empty. The category implementation in the deployed source commit matches these local category modules.

`npm.cmd run test:categories:integration` passed in a fresh isolated PostgreSQL cluster. It exercised category service creation, editing, references, inactive visibility, concurrent reorder, and deletion. The temporary cluster was removed by the existing test runner. This is local service/database evidence, not production browser or authenticated production POST evidence.

`npm.cmd run test:categories` also passed the existing category contract and additive migration checks.

The source requires a unique lowercase ASCII slug (2–64 characters; letters, digits, single hyphen separators), all three names (2–80 trimmed characters each), and a supported icon. The form currently surfaces the generic backend validation message without individual field details. These constraints are diagnostic candidates, not a confirmed cause of the user's failed request.

## Follow-up: confirmed failing field and local correction

The first investigation reached only the login screen. The user then logged in and submitted the form, providing a screenshot of `Request validation failed`. The existing production category tab was inspected without submitting or changing its form. It displayed these values:

- Slug: `test slug`
- Uzbek name: `yangi`
- Russian name: `noviy`
- English name: `new`
- Icon: `lock`; active: true

Replaying those values through the unchanged deployed source's `createCategorySchema.safeParse` rejects only `slug`, with `fieldErrors: { slug: ["Invalid"] }`. Changing only the slug to `test-slug` satisfies the same schema. The embedded space is the confirmed input validation failure. The frontend hid the field details already supplied by the backend, so the user saw only a generic English message.

Local correction:

- `admin-web/modules/categories/category-form.ts`: validate the slug and trimmed name lengths before saving; turn backend field validation errors into specific Uzbek guidance. The backend contract is unchanged.
- `admin-web/modules/categories/components/categories-manager.tsx`: show associated slug format help, expose errors as an accessible alert, and prevent invalid form submission before invoking the API. Editing continues to omit the immutable slug.
- `scripts/test-admin-category-form.cjs`: exercise the actual component's event handlers with mocked React/query/API adapters, using the real backend category schema for input checks. The reported invalid slug produces no API call and a descriptive alert; the corrected payload satisfies the backend schema. Edit and server-field-error paths also pass. This is a focused component/contract test, not browser or production mutation evidence.

Verification passed: `node scripts/test-admin-category-form.cjs`; admin TypeScript `--noEmit --incremental false`; ESLint on both changed modules with `--no-ignore --max-warnings 0`; production Next webpack build using the verified production API URL. Existing category contract and isolated database integration checks passed in the initial investigation. Staged and unstaged whitespace checks passed.

No production records, credentials, DNS, cloud configuration, deployment, or database migrations were changed. No test category was added to production; the user's draft was left intact. Existing unrelated local changes were preserved. The local form correction has **not been deployed**. A valid slug must still be unique; schema acceptance alone does not prove that a later production create will succeed.

Status: **PASS** for the failure diagnosis and scoped local form correction. The immediate input correction is `test slug` → `test-slug`; deploying the improved validation UI is a separate action.
