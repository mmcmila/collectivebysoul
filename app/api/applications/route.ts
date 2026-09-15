import { submitToGoogle, validateApplication } from "@/lib/google-form";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const reply = (body: object, status: number) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  // Same-origin requests only; no CORS.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return reply({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "invalid" }, 415);
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "invalid" }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return reply({ error: "too_large" }, 413);
      }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply({ error: "invalid" }, 400);
  }
  if (input && typeof input === "object" && "website" in input && input.website)
    return reply({ error: "invalid" }, 400);
  const result = validateApplication(input);
  if (!result.valid)
    return reply({ error: "invalid", fields: result.fields }, 400);
  try {
    await submitToGoogle(result.application);
    return reply({ ok: true }, 200);
  } catch {
    // Don't log contact details or retry: Google may have accepted it.
    return reply({ error: "unconfirmed" }, 502);
  }
}
