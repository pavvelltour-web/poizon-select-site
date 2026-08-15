# Frontend Production Boundary

This repository owns only the KICKSBASE storefront and the Docker Compose
service named `select`.

## Allowed Frontend Scope

- Application code and tests under `src/`.
- Static storefront assets under `public/` and their frontend manifests.
- Frontend-only build and verification scripts.
- `Dockerfile`, `nginx.conf`, `vite.config.ts`, and CI workflows only with an
  explicit infrastructure review.

## Backend Boundary

- Never edit, reset, pull, build, restart, or recreate `poizon-bot`, the API,
  bot, CRM, catalog-sync, PostgreSQL, database volumes, schemas, migrations,
  secrets, provider configuration, or the production Compose topology from a
  frontend task.
- Never place credentials, provider tokens, database URLs, or private API keys
  in `VITE_*`, frontend code, bundles, public assets, logs, or documentation.
- Keep browser traffic on the same-origin `/api` boundary. Do not call supplier
  or payment-provider endpoints directly from the browser.
- Preserve these public contracts unless a separate coordinated backend PR and
  compatibility test explicitly changes them:
  - `GET /api/checkout/orders?mode=catalog`
  - `POST /api/catalog/search`
  - `POST /api/checkout/orders`
- These storefront requests currently use `credentials: "include"`. Treat any
  credential-mode change as a reviewed cross-service contract change.
- Keep commerce fail-closed: unavailable or unverified supplier data must not
  become an invented price, stock state, or checkout-ready offer.

## Frontend Release Gate

1. Work in a dedicated clean frontend branch or worktree. Do not mix frontend
   and backend files in one commit.
2. Review the complete diff and run the frontend checks, production build,
   Nginx route tests, and desktop/mobile smoke tests.
3. Record the exact frontend Git SHA, current `select` image/container, and all
   backend container IDs and restart counts before deployment.
4. Build and recreate only `select`, using `docker compose up -d --no-deps
   --force-recreate select`. Never run `docker compose down`, a whole-stack
   `up --build`, migrations, or volume operations for a frontend release.
5. After deployment, prove backend container IDs are unchanged and verify the
   root page, `/catalog`, catalog assets, product hover frames, `/api/health`,
   catalog search, price catalog, and checkout contract behavior.
6. If a gate fails, roll back only the `select` image and frontend Git SHA.

