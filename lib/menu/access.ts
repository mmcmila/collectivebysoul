import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const menuCookieName = "soul_menu";
export const menuCookieMaxAge = 60 * 60 * 24 * 3;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** True only for the key printed in the QR code. Unset key keeps the menu closed. */
export function isMenuKey(key: string) {
  const expected = process.env.MENU_ACCESS_KEY;
  return !!expected && timingSafeEqual(digest(key), digest(expected));
}

/** Derived from the key, so rotating `MENU_ACCESS_KEY` also ends earlier visits. */
export const menuCookieValue = () =>
  digest(`menu:${process.env.MENU_ACCESS_KEY}`).toString("hex");

export async function hasMenuAccess() {
  if (!process.env.MENU_ACCESS_KEY) return false;
  const value = (await cookies()).get(menuCookieName)?.value ?? "";
  return timingSafeEqual(digest(value), digest(menuCookieValue()));
}
