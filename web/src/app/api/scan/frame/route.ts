import { ingestFrame } from "@/lib/store";
import { toSafeErrorResponse } from "@/lib/apiErrors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      roomId?: string;
      roomHint?: string;
      frameDataUrl?: string;
    };

    if (
      typeof body?.projectId !== "string" ||
      typeof body?.roomId !== "string" ||
      typeof body?.frameDataUrl !== "string" ||
      !body.projectId ||
      !body.roomId ||
      !body.frameDataUrl.startsWith("data:image/") ||
      body.frameDataUrl.length > 5_000_000
    ) {
      return Response.json(
        { error: "Invalid frame payload." },
        { status: 400 },
      );
    }

    const result = await ingestFrame({
      projectId: body.projectId,
      roomId: body.roomId,
      frameDataUrl: body.frameDataUrl,
      roomHint: body.roomHint,
    });

    return Response.json(result);
  } catch (error) {
    const { message, status } = toSafeErrorResponse(error);
    return Response.json({ error: message }, { status });
  }
}
