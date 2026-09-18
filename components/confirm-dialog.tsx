"use client";
import { useEffect, useRef, useState } from "react";

type Request = {
  text: string;
  confirmLabel: string;
  resolve: (answer: boolean) => void;
};

// One host per screen registers itself here; without a host (or when the
// browser lacks <dialog>) the native confirm is used.
let ask: ((request: Request) => void) | null = null;

/**
 * In-page replacement for window.confirm. Native JavaScript dialogs are
 * suppressed in some embedded browsers, which silently cancels every action
 * that asks for confirmation.
 */
export const confirmAction = (text: string, confirmLabel = "Sil") =>
  new Promise<boolean>((resolve) => {
    if (ask) ask({ text, confirmLabel, resolve });
    else resolve(window.confirm(text));
  });

export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    ask = (next) =>
      setRequest((current) => {
        current?.resolve(false);
        return next;
      });
    return () => {
      ask = null;
    };
  }, []);

  useEffect(() => {
    if (request && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [request]);

  if (!request) return null;
  const answer = (value: boolean) => {
    request.resolve(value);
    setRequest(null);
  };
  return (
    <dialog
      ref={dialog}
      className="ad-confirm"
      aria-labelledby="ad-confirm-text"
      // Escape and the back gesture count as "Vazgeç".
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
      onClick={(e) => {
        if (e.target === dialog.current) answer(false);
      }}
    >
      <div className="ad-confirm-body">
        <p id="ad-confirm-text">{request.text}</p>
        <div className="ad-confirm-actions">
          <button type="button" autoFocus onClick={() => answer(false)}>
            Vazgeç
          </button>
          <button
            type="button"
            className="ad-confirm-yes"
            onClick={() => answer(true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
