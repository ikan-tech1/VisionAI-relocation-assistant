import { getProject } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }
  return Response.json({ project });
}
