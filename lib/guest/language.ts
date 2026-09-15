export type GuestLanguage = "tr" | "en";
export const guestLanguageCookie = "soul_guest_language";
export function resolveGuestLanguage(
  saved?: string,
  acceptLanguage = "",
): GuestLanguage {
  if (saved === "tr" || saved === "en") return saved;
  const preferred = acceptLanguage
    .split(",")
    .map((item, index) => {
      const [tag, ...params] = item.trim().toLowerCase().split(";");
      const quality = params.find((p) => p.trim().startsWith("q="));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return preferred[0]?.tag.split("-")[0] === "en" ? "en" : "tr";
}
