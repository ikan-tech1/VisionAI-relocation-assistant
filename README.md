# Vision AI Relocation Assistant

Web-first application for live room scanning and automated relocation planning.

## What is implemented

- Live camera scanning UX in browser
- Frame sampling and backend inference endpoint
- Dedupe-aware item inventory generation
- Editable packing itinerary with task statuses
- Live state streaming via Server-Sent Events
- Export endpoints (CSV/PDF/JSON)
- Phase 2 starter APIs for calibration and load optimization
- Optional Postgres-backed persistence via `DATABASE_URL` (falls back to in-memory)

## Project structure

- `web` - Next.js application and API routes
- `services/vision` - Vision service scaffolding
- `services/itinerary` - Phase 2 optimization primitives
- `packages/types` - Shared domain types scaffold
- `infra` - Infrastructure placeholders

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Persistence configuration

Set `DATABASE_URL` to enable durable project persistence:

```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname
```

Without `DATABASE_URL`, the app runs in in-memory mode (good for local prototyping, not durable across server restarts).

Optional deployment auth gate:

```bash
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=change-me
```

When set, middleware enforces HTTP Basic auth across app and API routes.
