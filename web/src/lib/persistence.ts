import { Pool } from "pg";
import { RelocationProject } from "@/lib/domain";

export interface PersistedProjectState {
  project: RelocationProject;
  detectionSeen: Array<{ key: string; itemId: string; lastSeenAt: number }>;
}

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;

let schemaReady: Promise<void> | null = null;

export function isPersistenceEnabled(): boolean {
  return Boolean(pool);
}

async function ensureSchema(): Promise<void> {
  if (!pool) return;
  if (!schemaReady) {
    schemaReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS relocation_project_state (
          project_id VARCHAR(64) PRIMARY KEY,
          project_data JSONB NOT NULL,
          detection_seen JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

export async function saveProjectState(state: PersistedProjectState): Promise<void> {
  if (!pool) return;
  await ensureSchema();
  await pool.query(
    `
      INSERT INTO relocation_project_state (project_id, project_data, detection_seen, updated_at)
      VALUES ($1, $2::jsonb, $3::jsonb, NOW())
      ON CONFLICT (project_id)
      DO UPDATE
      SET project_data = EXCLUDED.project_data,
          detection_seen = EXCLUDED.detection_seen,
          updated_at = NOW();
    `,
    [state.project.id, JSON.stringify(state.project), JSON.stringify(state.detectionSeen)],
  );
}

export async function loadProjectState(projectId: string): Promise<PersistedProjectState | null> {
  if (!pool) return null;
  await ensureSchema();
  const result = await pool.query<{
    project_data: RelocationProject;
    detection_seen: Array<{ key: string; itemId: string; lastSeenAt: number }>;
  }>(
    `
      SELECT project_data, detection_seen
      FROM relocation_project_state
      WHERE project_id = $1
      LIMIT 1;
    `,
    [projectId],
  );
  if (result.rowCount === 0) return null;
  return {
    project: result.rows[0].project_data,
    detectionSeen: result.rows[0].detection_seen,
  };
}
