import { cookies, headers } from "next/headers";
import { GuestLanguageProvider } from "@/components/guest-language";
import {
  guestLanguageCookie,
  resolveGuestLanguage,
} from "@/lib/guest/language";
import type { Metadata } from "next";
import { GuestPlanner } from "@/components/guest-planner";
import { GuestLogin } from "@/components/guest-login";
import { currentGuest } from "@/lib/guest/session";
import { guestDb } from "@/lib/guest/db";
import { getAvailability } from "./actions";
import "./planner.css";
export const metadata: Metadata = {
  title: "Gününü planla · Soul Collective",
  robots: { index: false, follow: false },
};
export default async function GuestPage() {
  const initialLanguage = resolveGuestLanguage(
    (await cookies()).get(guestLanguageCookie)?.value,
    (await headers()).get("accept-language") ?? "",
  );
  const guest = await currentGuest();
  if (!guest)
    return (
      <GuestLanguageProvider initialLanguage={initialLanguage}>
        <GuestLogin />
      </GuestLanguageProvider>
    );
  const [plans, availability] = await Promise.all([
    guestDb()`SELECT data FROM guest_event.plans WHERE ticket_id=${guest.id}`,
    getAvailability(),
  ]);
  return (
    <GuestLanguageProvider initialLanguage={initialLanguage}>
      <GuestPlanner
        initial={{
          isDemo: guest.is_demo,
          plan: plans[0]?.data ?? null,
          availability,
        }}
      />
    </GuestLanguageProvider>
  );
}
