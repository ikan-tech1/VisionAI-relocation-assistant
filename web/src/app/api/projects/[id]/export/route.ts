import { getProject } from "@/lib/store";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(project: NonNullable<ReturnType<typeof getProject>>): string {
  const header = "item_id,label,room,quantity,fragile,width_cm,height_cm,depth_cm,task_count";
  const roomById = new Map(project.rooms.map((room) => [room.id, room.name]));
  const rows = project.items.map((item) => {
    const width = item.dimensions?.widthCm ?? "";
    const height = item.dimensions?.heightCm ?? "";
    const depth = item.dimensions?.depthCm ?? "";
    const taskCount = project.itineraryTasks.filter((task) => task.roomId === item.roomId).length;
    return [
      item.id,
      item.label,
      roomById.get(item.roomId) ?? item.roomId,
      item.quantity,
      item.fragile,
      width,
      height,
      depth,
      taskCount,
    ]
      .map(csvCell)
      .join(",");
  });
  return [header, ...rows].join("\n");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (format === "json") {
    return Response.json({ project });
  }

  const csv = toCsv(project);
  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}_itinerary.csv"`,
    },
  });
}
