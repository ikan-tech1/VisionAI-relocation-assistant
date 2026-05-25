import { ingestFrame } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      roomId?: string;
      roomHint?: string;
      frameDataUrl?: string;
    };

    if (!body?.projectId || !body?.roomId || !body?.frameDataUrl) {
      return Response.json(
        { error: "projectId, roomId and frameDataUrl are required." },
        { status: 400 },
      );
    }

    const result = ingestFrame({
      projectId: body.projectId,
      roomId: body.roomId,
      frameDataUrl: body.frameDataUrl,
      roomHint: body.roomHint,
    });

    return Response.json(result);
  } catch (error) {
    const message = String(error);
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
