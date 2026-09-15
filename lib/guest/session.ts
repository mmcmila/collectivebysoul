import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { guestDb } from "./db";

export const cookieName = "soul_guest_session";

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const newSessionToken = () => randomBytes(32).toString("hex");

export async function readSessionToken(name: string) {
  const token = (await cookies()).get(name)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function setSessionCookie(
  name: string,
  token: string,
  path: string,
  maxAge: number,
) {
  (await cookies()).set(name, token, {
    httpOnly: true,
    secure: process.env.VERCEL === "1",
    sameSite: "lax",
    path,
    maxAge,
  });
}

export async function clientKey() {
  const h = await headers();
  return hash(
    h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "local",
  );
}

export async function consumeLoginAttempt(key: string, max: number) {
  const [limit] =
    await guestDb()`INSERT INTO guest_event.login_limits (key,attempts,expires_at) VALUES (${key},1,now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN guest_event.login_limits.expires_at<now() THEN 1 ELSE guest_event.login_limits.attempts+1 END, expires_at=CASE WHEN guest_event.login_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE guest_event.login_limits.expires_at END RETURNING attempts`;
  return limit.attempts <= max;
}

export const currentGuest = cache(async () => {
  const token = await readSessionToken(cookieName);
  if (!token) return null;
  const [guest] =
    await guestDb()`SELECT t.id, t.is_demo FROM guest_event.sessions s JOIN guest_event.tickets t ON t.id=s.ticket_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND t.active`;
  return guest ?? null;
});
