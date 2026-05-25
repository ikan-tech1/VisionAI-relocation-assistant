import { isPersistenceEnabled } from "@/lib/persistence";

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    persistence: isPersistenceEnabled() ? "postgres" : "in-memory",
  });
}
