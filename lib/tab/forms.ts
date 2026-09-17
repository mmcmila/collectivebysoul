import type { KeyboardEvent } from "react";

/**
 * Phone keyboards send Enter/Go for the amount and name fields; submit the
 * surrounding form explicitly so the behaviour does not depend on implicit
 * submission rules, and prevent the default so it never submits twice.
 */
export function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}
