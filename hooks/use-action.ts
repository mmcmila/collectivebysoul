import { useState } from "react";

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run<T extends { error?: string }>(
    fallback: string,
    action: () => Promise<T>,
    onSuccess?: (result: T) => unknown,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (result.error) setError(result.error);
      else await onSuccess?.(result);
    } catch {
      setError(fallback);
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
