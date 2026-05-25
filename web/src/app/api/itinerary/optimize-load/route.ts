import { getProject } from "@/lib/store";
import { optimizeLoad } from "@/lib/phase2";
import { toSafeErrorResponse } from "@/lib/apiErrors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { projectId?: string };
    if (typeof body?.projectId !== "string" || !body.projectId) {
      return Response.json({ error: "projectId is required." }, { status: 400 });
    }

    const project = await getProject(body.projectId);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const recommendation = optimizeLoad(project);
    return Response.json({ recommendation });
  } catch (error) {
    const { message, status } = toSafeErrorResponse(error);
    return Response.json({ error: message }, { status });
  }
}
