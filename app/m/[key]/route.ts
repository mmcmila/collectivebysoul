import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  isMenuKey,
  menuCookieMaxAge,
  menuCookieName,
  menuCookieValue,
} from "@/lib/menu/access";

/** QR entry point: swaps the key in the link for a cookie, then shows `/menu`. */
export async function GET(_request: Request, ctx: RouteContext<"/m/[key]">) {
  const { key } = await ctx.params;
  if (!isMenuKey(key)) notFound();
  (await cookies()).set(menuCookieName, menuCookieValue(), {
    httpOnly: true,
    secure: process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/menu",
    maxAge: menuCookieMaxAge,
  });
  redirect("/menu");
}
