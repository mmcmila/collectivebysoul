import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/guest/admin-session";
import { AdminPanel } from "@/components/admin-panel";
import { AdminLogin } from "@/components/admin-login";
import { getAdminData } from "./actions";
import "./admin.css";
export const metadata: Metadata = {
  title: "Yönetim · Soul Collective",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  const user = await currentAdmin();
  if (!user) return <AdminLogin />;
  if (user.role !== "admin") redirect("/yonetim/adisyon");
  return <AdminPanel initial={await getAdminData()} />;
}
