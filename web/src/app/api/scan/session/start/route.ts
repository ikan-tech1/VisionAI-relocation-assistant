import { startScanSession } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      roomName?: string;
    };

    if (
      typeof body?.projectId !== "string" ||
      !body.projectId ||
      typeof body?.roomName !== "string" ||
      !body.roomName.trim()
    ) {
      return Response.json({ error: "projectId and roomName are required." }, { status: 400 });
    }

    const result = startScanSession(body.projectId, body.roomName.trim());
    return Response.json(result);
  } catch (error) {
    const message = String(error);
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
