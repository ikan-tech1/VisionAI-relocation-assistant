import { getProject } from "@/lib/store";
import { optimizeLoad } from "@/lib/phase2";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { projectId?: string };
    if (!body?.projectId) {
      return Response.json({ error: "projectId is required." }, { status: 400 });
    }

    const project = getProject(body.projectId);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const recommendation = optimizeLoad(project);
    return Response.json({ recommendation });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
