# Main hero and category banner separation — 2026-10-09

Baseline: branch `handoff/mac-xcode-f1-f4-20260919`, HEAD `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`. Existing dirty work preserved. Scoped pre-edit contents and task-only diff are in `artifacts/banner-placements-2026-10-09/`.

The previous admin editor listed every banner and forced placement CATEGORY when editing. Home displayed a static introduction and did not fetch HOME banners. Both defects are corrected locally.

| Placement | Local admin CRUD | Mobile slot |
| --- | --- | --- |
| HOME | http://127.0.0.1:3000/content/banners | One 200px hero above categories; default introduction when no active HOME banners exist |
| CATEGORY | http://127.0.0.1:3000/content/banners/category | 64px strip immediately below sort buttons |

Each page has its own keyed editor, query key, filtered API response, preview ratio, and ordering. Creation fixes the placement to that editor. Editing cannot migrate a banner between placements. Images, muted MP4 video, category navigation, external HTTP(S) navigation, activation, deletion and carousel controls remain supported in both slots. No additional advertisement is rendered below the home categories.

Backend admin listing accepts an optional placement; omitted placement preserves legacy all-banner listing. New banner sort indexes advance only in their own placement. Scoped reorder validates every ID before updating, rejects cross-placement and duplicate IDs, and returns only the selected placement. Legacy reorder without placement remains accepted. Public default feed remains HOME. No new migration was needed beyond the pre-existing banner placement/media migration in this worktree.

Verification performed:

- `cd backend; npm.cmd run test:banner-media` — PASS against a fresh disposable PostgreSQL cluster. Upload authorization/formats/limits, image and video range transport, HOME/CATEGORY feeds, separate ordering, create/edit/targets/toggle/delete, cross-placement edit rejection and atomic failed reorder. Temporary cluster and uploaded transport fixtures removed by the runner.
- `cd backend; npm.cmd run build` — PASS.
- `cd admin-web; node node_modules/typescript/bin/tsc --noEmit` — PASS.
- Admin scoped ESLint with `--no-ignore` for both banner pages, manager, navigation, hook and service — PASS. Initial lint commands without `--no-ignore` skipped files; those results were discarded and the check rerun correctly.
- `node scripts/test-admin-banner-placements.cjs` — PASS. Actual TSX handlers with mocked React/transport: placement filtering, create/edit/toggle/reorder, separate route keys/cache, upload pending guard, and late upload isolation across route unmount.
- `node scripts/test-mobile-banner-placements.cjs` — PASS. Actual screen/carousel components with mocked native APIs: single HOME hero, empty/inactive hero fallback, mount/refresh feeds, category strip directly below SORT, mixed-cache protection, 200px/64px card styles and link/category targets.
- `node scripts/test-banner-model.mjs` — PASS. Legacy defaults, safe target resolution, active placement filtering, stable input cache and wrap-around.
- Scoped mobile/test ESLint — PASS.
- Local Codex browser — both authenticated pages rendered with the correct headings, descriptions and lists. Existing `new` category banner appears only in the CATEGORY list; HOME currently has no banners. Opening category edit then switching to HOME reset the editor to a new empty HOME draft; returning CATEGORY did not restore a stale edit. Screenshots saved as `main-hero-admin.jpg` and `category-admin.jpg` in the artifact directory.
- `git diff --check` and staged equivalent — PASS (pre-existing Windows line-ending notices only). Task-only delta reviewed against captured pre-edit contents.

Changed source areas: `admin-web/app/(dashboard)/content/banners`, `admin-web/modules/banners`, `backend/src/modules/banners`, mobile Home/Category screens, `BannerCarousel`, and banner model. Regression scripts are beside the existing banner tests.

Remaining gate: fresh native screen/video playback verification on Android/iPhone. Earlier automatic approval review blocked Expo startup with “blocked by policy” and emulator capture/control was also rejected. Those actions were not retried or bypassed. A user-started Expo session must reload the current source and confirm the HOME hero and CATEGORY strip, image/video playback, swipe/pause and targets. Backend HTTP/video transport and mocked native component checks do not prove device playback.

Only local source changed. No production deployment or production data mutation performed.

CONDITIONAL
