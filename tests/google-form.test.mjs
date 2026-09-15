import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateApplication,
  buildGooglePayload,
  isGoogleConfirmation,
  submitToGoogle,
  GOOGLE_ENTRIES,
  TERMS_ANSWER,
  CONFIRMATION,
} from "../lib/google-form.ts";
const application = {
  name: "Test Guest",
  phone: "+90 555 000 0000",
  email: "test@example.com",
  instagram: "",
  reference: "",
  party: "2",
  terms: true,
  language: "en",
};
test("validates and trims applications while keeping optional fields optional", () => {
  const result = validateApplication({
    ...application,
    name: " Test Guest ",
    reference: undefined,
  });
  assert.equal(result.valid, true);
  assert.equal(result.application.name, "Test Guest");
  assert.equal(result.application.reference, "");
});
test("rejects invalid contact details, party size, missing consent and unsupported language", () => {
  const result = validateApplication({
    ...application,
    name: " ",
    phone: "abc",
    email: "bad",
    party: "50",
    terms: false,
    language: "xx",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.fields, [
    "name",
    "phone",
    "email",
    "party",
    "terms",
    "language",
  ]);
  assert.equal(validateApplication(null).valid, false);
  assert.equal(
    validateApplication({ ...application, reference: "x".repeat(501) }).valid,
    false,
  );
});
test("maps event fields, party and consent to Google entry values", () => {
  const payload = buildGooglePayload(application);
  assert.equal(payload.get(GOOGLE_ENTRIES.name), "Test Guest");
  assert.equal(payload.get(GOOGLE_ENTRIES.email), "test@example.com");
  assert.equal(payload.get(GOOGLE_ENTRIES.party), "2");
  assert.equal(payload.get(GOOGLE_ENTRIES.terms), TERMS_ANSWER);
  assert.equal(payload.get(GOOGLE_ENTRIES.language), "en");
});
test("requires visible confirmation, rejecting configuration text and error forms", () => {
  assert.equal(isGoogleConfirmation(`<div>${CONFIRMATION}</div>`), true);
  assert.equal(
    isGoogleConfirmation(
      `<script>const message="${CONFIRMATION}"</script><div>Form closed</div>`,
    ),
    false,
  );
  assert.equal(isGoogleConfirmation(`<form>${CONFIRMATION}</form>`), false);
});
test("rejects Google errors and unconfirmed HTTP 200 responses", async () => {
  for (const response of [
    new Response("Closed", { status: 403 }),
    new Response("<form>Required field</form>"),
  ]) {
    await assert.rejects(submitToGoogle(application, async () => response));
  }
  await assert.rejects(
    submitToGoogle(application, async () => {
      throw new Error("Network error");
    }),
  );
});
test("sends URL-encoded application and accepts actual confirmation", async () => {
  await submitToGoogle(application, async (url, options) => {
    assert.match(url, /\/formResponse$/);
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.body.get(GOOGLE_ENTRIES.phone), application.phone);
    return new Response(`<div>${CONFIRMATION}</div>`);
  });
});
