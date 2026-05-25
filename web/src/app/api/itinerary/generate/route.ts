import { regenerateItinerary } from "@/lib/store";
import { toSafeErrorResponse } from "@/lib/apiErrors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { projectId?: string };
    if (typeof body?.projectId !== "string" || !body.projectId) {
      return Response.json({ error: "projectId is required." }, { status: 400 });
    }

    const project = await regenerateItinerary(body.projectId);
    return Response.json({ project });
  } catch (error) {
    const { message, status } = toSafeErrorResponse(error);
    return Response.json({ error: message }, { status });
  }
}
