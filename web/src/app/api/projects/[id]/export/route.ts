import { getProject } from "@/lib/store";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { RelocationProject } from "@/lib/domain";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(project: RelocationProject): string {
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

async function toPdf(project: RelocationProject): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 760;

  const drawLine = (text: string, isHeading = false) => {
    if (y < 52) {
      page = pdf.addPage([612, 792]);
      y = 760;
    }
    page.drawText(text, {
      x: 40,
      y,
      size: isHeading ? 13 : 10,
      font: isHeading ? bold : font,
      color: isHeading ? rgb(0.08, 0.18, 0.32) : rgb(0, 0, 0),
    });
    y -= isHeading ? 18 : 14;
  };

  drawLine(`Vision AI Relocation Itinerary - ${project.name}`, true);
  drawLine(`Move date: ${project.moveDate ?? "Not set"}`);
  drawLine(`Generated at: ${new Date().toISOString()}`);
  y -= 6;
  drawLine("Rooms", true);
  for (const room of project.rooms) {
    drawLine(`- ${room.name} (${room.scanStatus})`);
  }
  y -= 6;
  drawLine("Inventory Items", true);
  for (const item of project.items) {
    drawLine(
      `- ${item.label} | fragile=${item.fragile ? "yes" : "no"} | confidence=${Math.round(
        item.confidence * 100,
      )}%`,
    );
  }
  y -= 6;
  drawLine("Itinerary Tasks", true);
  for (const task of project.itineraryTasks) {
    drawLine(`- [${task.status}] (${task.priority}) ${task.title}`);
  }

  return pdf.save();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (format === "json") {
    return Response.json({ project });
  }
  if (format === "pdf") {
    const pdfBytes = await toPdf(project);
    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const pdfBuffer = Buffer.from(pdfBytes);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}_itinerary.pdf"`,
      },
    });
  }
  if (format !== "csv") {
    return Response.json({ error: "Unsupported export format." }, { status: 400 });
  }

  const csv = toCsv(project);
  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}_itinerary.csv"; filename*=UTF-8''${encodeURIComponent(
        project.name,
      )}_itinerary.csv`,
    },
  });
}
