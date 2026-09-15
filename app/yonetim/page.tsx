import type { Metadata } from "next";
import { currentAdmin } from "@/lib/guest/admin-session";
import { AdminPanel } from "@/components/admin-panel";
import { AdminLogin } from "@/components/admin-login";
import { getAdminData } from "./actions";
import "./admin.css";
export const metadata:Metadata={title:"Yönetim · Soul Collective",robots:{index:false,follow:false}};
export default async function AdminPage(){
 if(!await currentAdmin())return <AdminLogin/>;
 return <AdminPanel initial={await getAdminData()}/>;
}
