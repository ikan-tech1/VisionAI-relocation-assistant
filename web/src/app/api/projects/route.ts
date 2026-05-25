import { createProject } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      moveDate?: string;
      retentionMode?: "standard" | "ephemeral";
      confidenceReviewThreshold?: number;
    };
    if (!body?.name?.trim()) {
      return Response.json({ error: "Project name is required." }, { status: 400 });
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
