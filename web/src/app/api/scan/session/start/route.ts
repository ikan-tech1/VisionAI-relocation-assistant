import { startScanSession } from "@/lib/store";
import { toSafeErrorResponse } from "@/lib/apiErrors";

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

    const result = await startScanSession(body.projectId, body.roomName.trim());
    return Response.json(result);
  } catch (error) {
    const { message, status } = toSafeErrorResponse(error);
    return Response.json({ error: message }, { status });
  }
}
