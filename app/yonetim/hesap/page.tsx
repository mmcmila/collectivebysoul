import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin-login";
import { TabModule } from "@/components/tab-module";
import { currentAdmin } from "@/lib/guest/admin-session";
import { loadTabData } from "@/lib/tab/data";
import "../admin.css";
import "./tab.css";
export const metadata: Metadata = {
  title: "Açık Hesap · Soul Collective",
  robots: { index: false, follow: false },
};
export default async function TabPage() {
  const user = await currentAdmin();
  if (!user) return <AdminLogin />;
  return <TabModule user={user} initial={await loadTabData(user)} />;
}
