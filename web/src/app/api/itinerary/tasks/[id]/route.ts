import { updateTask } from "@/lib/store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      projectId?: string;
      status?: "pending" | "in_progress" | "done";
      priority?: "low" | "medium" | "high";
      notes?: string;
      title?: string;
    };

    if (!body?.projectId) {
      return Response.json({ error: "projectId is required." }, { status: 400 });
    }

    const result = updateTask(body.projectId, id, {
      status: body.status,
      priority: body.priority,
      notes: body.notes,
      title: body.title,
    });
    return Response.json(result);
  } catch (error) {
    const message = String(error);
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
