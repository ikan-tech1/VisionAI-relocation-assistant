import { calibrateScale } from "@/lib/phase2";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      referenceObject?: "credit_card" | "a4_paper" | "standard_box";
      observedPixelWidth?: number;
    };

    if (!body.referenceObject || !body.observedPixelWidth) {
      return Response.json(
        { error: "referenceObject and observedPixelWidth are required." },
        { status: 400 },
      );
    }

    const calibration = calibrateScale({
      referenceObject: body.referenceObject,
      observedPixelWidth: body.observedPixelWidth,
    });

    return Response.json({ calibration });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
