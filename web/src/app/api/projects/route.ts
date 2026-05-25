import { createProject } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      moveDate?: string;
      retentionMode?: "standard" | "ephemeral";
      confidenceReviewThreshold?: number;
    };
    if (
      typeof body?.name !== "string" ||
      !body.name.trim() ||
      (body.moveDate !== undefined && typeof body.moveDate !== "string") ||
      (body.retentionMode !== undefined &&
        body.retentionMode !== "standard" &&
        body.retentionMode !== "ephemeral") ||
      (body.confidenceReviewThreshold !== undefined &&
        (typeof body.confidenceReviewThreshold !== "number" ||
          body.confidenceReviewThreshold < 0.5 ||
          body.confidenceReviewThreshold > 0.95))
    ) {
      return Response.json({ error: "Invalid project payload." }, { status: 400 });
    }

    const project = createProject(body.name.trim(), body.moveDate, {
      retentionMode: body.retentionMode,
      confidenceReviewThreshold: body.confidenceReviewThreshold,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: "Unable to create project.", details: String(error) },
      { status: 500 },
    );
  }
}
