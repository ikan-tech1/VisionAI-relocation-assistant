import { regenerateItinerary } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { projectId?: string };
    if (typeof body?.projectId !== "string" || !body.projectId) {
      return Response.json({ error: "projectId is required." }, { status: 400 });
    }

    const project = regenerateItinerary(body.projectId);
    return Response.json({ project });
  } catch (error) {
    const message = String(error);
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
