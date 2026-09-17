import { currentAdmin } from "@/lib/guest/admin-session";
import { buildCsv } from "@/lib/tab/calc";
import { loadTabData } from "@/lib/tab/data";

export async function GET() {
  const user = await currentAdmin();
  if (!user) return new Response("Giriş gerekli.", { status: 401 });
  const data = await loadTabData(user);
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace("T", "-")
    .replace(":", "");
  // UTF-8 BOM so Excel on Windows reads Turkish characters correctly.
  return new Response("﻿" + buildCsv(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="acik-hesap-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
