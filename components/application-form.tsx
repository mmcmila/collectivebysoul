"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { copy } from "@/components/event-content";
import { validateApplication, type ApplicationField } from "@/lib/google-form";

const feedback = {
  tr: {
    pending: "Gönderiliyor…",
    received: "Başvurun alındı",
    invalid: "Lütfen işaretli alanları kontrol et.",
    success:
      "Başvurun alındı. 72 saat içinde sana döneceğiz. Yerin henüz onaylanmadı.",
    error:
      "Başvurunun alındığını doğrulayamadık. Bilgilerin bu sayfada duruyor. Tekrar göndermeden önce bize yazabilir veya yeniden deneyebilirsin.",
    fields: {
      name: "Adını ve soyadını gir (2–120 karakter).",
      phone: "Geçerli bir telefon numarası gir.",
      email: "Geçerli bir e-posta adresi gir.",
      instagram: "En fazla 120 karakter kullan.",
      reference: "En fazla 500 karakter kullan.",
      party: "1, 2 veya 3 kişi seç.",
      terms: "Devam etmek için koşulları kabul et.",
      language: "TR veya EN seç.",
    },
  },
  en: {
    pending: "Submitting…",
    received: "Application received",
    invalid: "Please check the highlighted fields.",
    success:
      "Application received. We will reply within 72 hours. Your place is not yet confirmed.",
    error:
      "We couldn’t confirm receipt. Your details are still on this page. You can contact us before resubmitting, or try again.",
    fields: {
      name: "Enter your full name (2–120 characters).",
      phone: "Enter a valid phone number.",
      email: "Enter a valid email address.",
      instagram: "Use no more than 120 characters.",
      reference: "Use no more than 500 characters.",
      party: "Choose 1, 2 or 3 guests.",
      terms: "Accept the terms to continue.",
      language: "Choose TR or EN.",
    },
  },
};

export function ApplicationForm({ language }: { language: "tr" | "en" }) {
  const [status, setStatus] = useState<
    "idle" | "pending" | "success" | "invalid" | "error"
  >("idle");
  const [invalidFields, setInvalidFields] = useState<ApplicationField[]>([]);
  const busy = useRef(false);
  const message = useRef<HTMLParagraphElement>(null);
  const t = copy[language];
  const f = feedback[language];
  const locked = status === "pending" || status === "success";
  const invalid = (field: ApplicationField) => invalidFields.includes(field);
  function showInvalid(fields: ApplicationField[], form: HTMLFormElement) {
    setInvalidFields(fields);
    setStatus("invalid");
    requestAnimationFrame(() => {
      const control = form.elements.namedItem(fields[0]);
      if (control instanceof HTMLElement) control.focus();
    });
  }
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || status === "success") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      ...Object.fromEntries(data),
      terms: data.get("terms") === "on",
      language,
    };
    const validated = validateApplication(payload);
    if (!validated.valid) {
      showInvalid(validated.fields, form);
      return;
    }
    busy.current = true;
    setInvalidFields([]);
    setStatus("pending");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validated.application,
          website: data.get("website"),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json();
      if (
        response.status === 400 &&
        Array.isArray(result.fields) &&
        result.fields.length
      ) {
        showInvalid(result.fields, form);
        return;
      }
      if (!response.ok || result.ok !== true)
        throw new Error("Unconfirmed submission");
      setStatus("success");
      // Retain values on failure; clear personal details only after confirmation.
      form.reset();
      requestAnimationFrame(() => message.current?.focus());
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }
  return (
    <form onSubmit={apply} noValidate aria-busy={status === "pending"}>
      <fieldset disabled={locked} className="application-fieldset">
        <legend className="sr-only">{t["apply.title"]}</legend>
        <FieldGroup className="application-form">
          {(["name", "phone", "email", "instagram", "reference"] as const).map(
            (key) => (
              <Field className="field" key={key} data-invalid={invalid(key)}>
                <FieldLabel htmlFor={key}>{t[`form.${key}`]}</FieldLabel>
                <Input
                  id={key}
                  name={key}
                  type={
                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                  }
                  autoComplete={
                    key === "name"
                      ? "name"
                      : key === "email"
                        ? "email"
                        : key === "phone"
                          ? "tel"
                          : undefined
                  }
                  required={["name", "phone", "email"].includes(key)}
                  maxLength={
                    key === "reference"
                      ? 500
                      : key === "email"
                        ? 254
                        : key === "phone"
                          ? 32
                          : 120
                  }
                  placeholder={key === "instagram" ? "@" : undefined}
                  aria-invalid={invalid(key)}
                  aria-describedby={invalid(key) ? `${key}-error` : undefined}
                />
                {invalid(key) && (
                  <FieldError id={`${key}-error`}>{f.fields[key]}</FieldError>
                )}
              </Field>
            ),
          )}
          <Field className="field" data-invalid={invalid("party")}>
            <FieldLabel htmlFor="party">{t["form.party"]}</FieldLabel>
            <select
              id="party"
              name="party"
              aria-invalid={invalid("party")}
              aria-describedby={invalid("party") ? "party-error" : undefined}
            >
              {(["one", "two", "three"] as const).map((key, i) => (
                <option key={key} value={i + 1}>
                  {t[`form.${key}`]}
                </option>
              ))}
            </select>
            {invalid("party") && (
              <FieldError id="party-error">{f.fields.party}</FieldError>
            )}
          </Field>
          <div className="application-honeypot" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <Field className="form-wide" data-invalid={invalid("terms")}>
            <label className="form-check" htmlFor="terms">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                required
                aria-invalid={invalid("terms")}
                aria-describedby={invalid("terms") ? "terms-error" : undefined}
              />
              <span>
                {t["form.t1"]}{" "}
                <a className="inline-link" href="#sss">
                  {t["form.t2"]}
                </a>{" "}
                {t["form.t3"]}
              </span>
            </label>
            {invalid("terms") && (
              <FieldError id="terms-error">{f.fields.terms}</FieldError>
            )}
          </Field>
          <p className="form-note form-wide">{t["form.note"]}</p>
          <Button
            type="submit"
            size="lg"
            className="form-wide"
            disabled={locked}
          >
            {status === "pending" ? (
              <>
                <Spinner aria-hidden="true" data-icon="inline-start" />
                {f.pending}
              </>
            ) : status === "success" ? (
              <>
                <Check data-icon="inline-start" />
                {f.received}
              </>
            ) : (
              <>
                {t["form.submit"]}
                <ArrowRight data-icon="inline-end" />
              </>
            )}
          </Button>
        </FieldGroup>
      </fieldset>
      <p
        ref={message}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="application-status"
      >
        {status === "success"
          ? f.success
          : status === "error"
            ? f.error
            : status === "invalid"
              ? f.invalid
              : ""}
      </p>
      {status === "error" && (
        <a className="inline-link" href="mailto:hello@soulcollective.co">
          hello@soulcollective.co
        </a>
      )}
    </form>
  );
}
