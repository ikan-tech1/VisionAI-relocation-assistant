export function toSafeErrorResponse(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("not found")) {
    return { status: 404, message };
  }
  if (
    lower.includes("required") ||
    lower.includes("invalid") ||
    lower.includes("payload") ||
    lower.includes("failed")
  ) {
    return { status: 400, message };
  }

  console.error("Unhandled API error:", error);
  return { status: 500, message: "Internal server error." };
}
