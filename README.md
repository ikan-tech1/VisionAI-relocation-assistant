# Vision AI Relocation Assistant

Web-first application for live room scanning and automated relocation planning.

## What is implemented

- Live camera scanning UX in browser
- Frame sampling and backend inference endpoint
- Dedupe-aware item inventory generation
- Editable packing itinerary with task statuses
- Live state streaming via Server-Sent Events
- Export endpoints (CSV/JSON)
- Phase 2 starter APIs for calibration and load optimization

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
