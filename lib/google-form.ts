// Public Google Form identifiers, not credentials. Keep these in sync with the form.
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScyCp7khmAbbe0Yny74eZ-4rOmCAZQlmIoWJiqh4FqPRx7DCQ/viewform";
const GOOGLE_FORM_ACTION = GOOGLE_FORM_URL.replace(/viewform$/, "formResponse");
export const GOOGLE_ENTRIES = {
  name: "entry.1553520750",
  phone: "entry.1921542573",
  email: "entry.1007737922",
  instagram: "entry.1905734872",
  reference: "entry.191084949",
  party: "entry.258698757",
  terms: "entry.375203160",
  language: "entry.1433511310",
} as const;
export const TERMS_ANSWER = "Okudum, kabul ediyorum / I have read and accept";
export const CONFIRMATION =
  "Application received. We will reply within 72 hours. Your place is not yet confirmed.";

export type Application = {
  name: string;
  phone: string;
  email: string;
  instagram: string;
  reference: string;
  party: "1" | "2" | "3";
  terms: true;
  language: "tr" | "en";
};
export type ApplicationField = keyof Application;
type ValidationResult =
  | { valid: true; application: Application }
  | { valid: false; fields: ApplicationField[] };

export function validateApplication(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, fields: ["name"] };
  }
  const data = input as Record<string, unknown>;
  const text = (key: string) =>
    typeof data[key] === "string" ? data[key].trim() : "";
  const name = text("name"),
    phone = text("phone"),
    email = text("email");
  const instagram = text("instagram"),
    reference = text("reference");
  const party = text("party"),
    language = text("language");
  const fields: ApplicationField[] = [];
  if (name.length < 2 || name.length > 120 || /[\r\n]/.test(name))
    fields.push("name");
  if (!/^[+\d().\s-]{7,32}$/.test(phone) || phone.replace(/\D/g, "").length < 7)
    fields.push("phone");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fields.push("email");
  if (
    instagram.length > 120 ||
    (data.instagram != null && typeof data.instagram !== "string")
  )
    fields.push("instagram");
  if (
    reference.length > 500 ||
    (data.reference != null && typeof data.reference !== "string")
  )
    fields.push("reference");
  if (party !== "1" && party !== "2" && party !== "3") fields.push("party");
  if (data.terms !== true) fields.push("terms");
  if (language !== "tr" && language !== "en") fields.push("language");
  if (
    fields.length ||
    (party !== "1" && party !== "2" && party !== "3") ||
    (language !== "tr" && language !== "en")
  )
    return { valid: false, fields };
  return {
    valid: true,
    application: {
      name,
      phone,
      email,
      instagram,
      reference,
      party,
      terms: true,
      language,
    },
  };
}

export function buildGooglePayload(application: Application) {
  const payload = new URLSearchParams({ fvv: "1", pageHistory: "0" });
  for (const [key, entry] of Object.entries(GOOGLE_ENTRIES)) {
    payload.set(
      entry,
      key === "terms"
        ? TERMS_ANSWER
        : String(application[key as ApplicationField]),
    );
  }
  return payload;
}

export function isGoogleConfirmation(html: string) {
  // Ignore embedded confirmation text on invalid forms.
  const visibleHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  if (/<form\b/i.test(visibleHtml)) return false;
  return visibleHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .includes(CONFIRMATION);
}

export async function submitToGoogle(
  application: Application,
  send: typeof fetch = fetch,
) {
  const response = await send(GOOGLE_FORM_ACTION, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: buildGooglePayload(application),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok || !isGoogleConfirmation(await response.text())) {
    throw new Error("Google did not confirm the application");
  }
}
