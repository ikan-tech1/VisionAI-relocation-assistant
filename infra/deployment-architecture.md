# Deployment Architecture (Production)

## Recommended baseline

- Frontend/API: Vercel (`web` Next.js project)
- Database: managed Postgres (Supabase/Neon/Vercel Postgres)
- Object storage: S3-compatible bucket for future frame archival
- Observability: request logging + uptime checks + error alerting

## Runtime modes

1. **Durable mode (recommended):**
   - Set `DATABASE_URL`
   - API reads/writes project state to Postgres
2. **Prototype mode:**
   - Omit `DATABASE_URL`
   - State is in-memory only

## Health and readiness

- `GET /api/health` returns:
  - `status`
  - `timestamp`
  - active persistence mode (`postgres` or `in-memory`)

## Next hardening steps

1. Add user identity and project-level authorization
2. Move from JSON-state persistence to normalized relational schema
3. Add migration tooling and backup strategy
4. Add encrypted storage for sensitive user data
