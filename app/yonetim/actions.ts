"use server";
import {validFortuneTime,conflictingWorkshop,FORTUNE_MAX_SLOTS} from "@/lib/guest/fortune";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/guest/admin-password";
import { randomBytes, randomInt } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { guestDb } from "@/lib/guest/db";
import { hash } from "@/lib/guest/session";
import { adminCookie, currentAdmin } from "@/lib/guest/admin-session";
import type { AdminData } from "@/lib/guest/admin-types";

export async function loginAdmin(code:string, remember=false) {
 if(typeof code!=="string"||code.length>120) return {error:"Yönetim kodunu kontrol et."};
 try {
  const sql=guestDb(); const h=await headers(); const key="admin:"+hash(h.get("x-real-ip")||h.get("x-forwarded-for")?.split(",")[0]||"local");
  const [limit]=await sql`INSERT INTO guest_event.login_limits(key,attempts,expires_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN guest_event.login_limits.expires_at<now() THEN 1 ELSE guest_event.login_limits.attempts+1 END,expires_at=CASE WHEN guest_event.login_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE guest_event.login_limits.expires_at END RETURNING attempts`;
  if(limit.attempts>8) return {error:"Çok fazla deneme. 15 dakika sonra yeniden dene."};
  const [admin]=await sql`SELECT id,code_hash FROM guest_event.admins WHERE name='Organizatör' AND active`;
  if(!admin || !await verifyAdminPassword(code,admin.code_hash))return {error:"Şifre veya yönetim kodu geçersiz. Biletli giriş kodları burada kullanılamaz."};
  const token=randomBytes(32).toString("hex");
  const maxAge=remember===true?30*86400:12*3600;
  const accepted=await sql.begin(async tx=>{
   const [current]=await tx`SELECT code_hash FROM guest_event.admins WHERE id=${admin.id} AND active FOR UPDATE`;
   if(!current||current.code_hash!==admin.code_hash)return false;
   await tx`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${admin.id},${new Date(Date.now()+maxAge*1000)})`;
   return true;
  });
  if(!accepted)return {error:"Giriş bilgileri değişti. Yeni şifrenle tekrar dene."};
  await sql`DELETE FROM guest_event.login_limits WHERE key=${key}`;
  (await cookies()).set(adminCookie,token,{httpOnly:true,secure:process.env.VERCEL==="1",sameSite:"lax",path:"/yonetim",maxAge});
  return {ok:true};
 } catch (error) { console.error("Admin login unavailable", {code: typeof error === "object" && error && "code" in error ? String(error.code) : "unknown"}); return {error:"Bağlantı kurulamadı. Biraz sonra tekrar dene."}; }
}
export async function logoutAdmin(){
 const jar=await cookies(); const token=jar.get(adminCookie)?.value;
 if(token)await guestDb()`DELETE FROM guest_event.admin_sessions WHERE token_hash=${hash(token)}`;
 jar.set(adminCookie,"",{path:"/yonetim",maxAge:0}); redirect("/yonetim");
}
export async function getAdminData():Promise<AdminData>{
 if(!await currentAdmin())redirect("/yonetim");
 const sql=guestDb();
 const [guests,workshops]=await Promise.all([
  sql`SELECT t.id,t.name,t.active,t.is_demo,t.category,t.created_at,p.updated_at,p.data FROM guest_event.tickets t LEFT JOIN guest_event.plans p ON p.ticket_id=t.id ORDER BY p.updated_at DESC NULLS LAST,t.created_at DESC`,
  sql`SELECT w.id,w.capacity,w.enabled,count(t.id)::int AS booked,COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)) FILTER(WHERE t.id IS NOT NULL),'[]'::jsonb) AS guests FROM guest_event.workshops w LEFT JOIN guest_event.reservations r ON r.workshop_id=w.id LEFT JOIN guest_event.tickets t ON t.id=r.ticket_id AND t.active AND NOT t.is_demo GROUP BY w.id ORDER BY w.id`
 ]);
 return {guests:guests.map(g=>({id:g.id,name:g.name,active:g.active,category:g.category,isDemo:g.is_demo,createdAt:g.created_at.toISOString(),updatedAt:g.updated_at?.toISOString()??null,plan:g.data??null})),workshops:workshops.map(w=>({id:w.id,capacity:w.capacity,booked:w.booked,enabled:w.enabled,guests:w.guests})),fetchedAt:new Date().toISOString()};
}
export async function issueGuest(name:string,paid:boolean,requestId:string,category:"paid"|"team"|"guest"="paid"){
 if(!await currentAdmin())return {error:"Yönetim oturumun sona erdi. Yeniden giriş yap."};
 if(typeof name!=="string" || name.trim().length<2 || name.length>120 || (!["paid","team","guest"].includes(category) || (category==="paid"&&paid!==true)) || typeof requestId!=="string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId))return {error:"Ad soyadı yaz ve ödeme onayını işaretle."};
 try {
  const sql=guestDb();
  for(let attempt=0;attempt<20;attempt++){
   const raw=String(randomInt(10000,100000));
   const rows=await sql`INSERT INTO guest_event.tickets(name,code_hash,issue_request_id,category) VALUES(${name.trim()},${hash(raw)},${requestId},${category}) ON CONFLICT DO NOTHING RETURNING id`;
   if(rows.length)return {id:String(rows[0].id),name:name.trim(),code:raw};
   const existing=await sql`SELECT id FROM guest_event.tickets WHERE issue_request_id=${requestId}`;
   if(existing.length)return {error:"Bu işlem daha önce tamamlandı; ikinci bir bilet oluşturulmadı. Listeyi kontrol et."};
  }
  return {error:"Kod oluşturulamadı. Tekrar deneyebilirsin."};
 }catch{return {error:"İşlem doğrulanamadı. Aynı formu tekrar deneyebilirsin; ikinci kayıt oluşturulmaz."};}
}

export async function changeAdminPassword(currentPassword:string,newPassword:string,remember:boolean){
 const admin=await currentAdmin();
 if(!admin)return {error:"Oturumun sona erdi. Yeniden giriş yap."};
 if(typeof currentPassword!=="string"||currentPassword.length>120||typeof newPassword!=="string"||newPassword.length<12||newPassword.length>120)return {error:"Yeni şifren 12–120 karakter olmalı."};
 if(currentPassword===newPassword)return {error:"Yeni şifren mevcut şifrenden farklı olsun."};
 try{
  const sql=guestDb();const key="password-change:"+admin.id;
  const [limit]=await sql`INSERT INTO guest_event.login_limits(key,attempts,expires_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN guest_event.login_limits.expires_at<now() THEN 1 ELSE guest_event.login_limits.attempts+1 END,expires_at=CASE WHEN guest_event.login_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE guest_event.login_limits.expires_at END RETURNING attempts`;
  if(limit.attempts>8)return {error:"Çok fazla deneme. 15 dakika sonra tekrar dene."};
  const token=randomBytes(32).toString("hex");const maxAge=remember===true?30*86400:43200;
  const changed=await sql.begin(async tx=>{
   const [row]=await tx`SELECT code_hash FROM guest_event.admins WHERE id=${admin.id} AND active FOR UPDATE`;
   if(!row||!await verifyAdminPassword(currentPassword,row.code_hash))return false;
   await tx`UPDATE guest_event.admins SET code_hash=${await hashAdminPassword(newPassword)} WHERE id=${admin.id}`;
   await tx`DELETE FROM guest_event.admin_sessions WHERE admin_id=${admin.id}`;
   await tx`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${admin.id},${new Date(Date.now()+maxAge*1000)})`;
   await tx`DELETE FROM guest_event.login_limits WHERE key=${key}`;
   return true;
  });
  if(!changed)return {error:"Mevcut şifre veya yönetim kodu doğru değil."};
  (await cookies()).set(adminCookie,token,{httpOnly:true,secure:process.env.VERCEL==="1",sameSite:"lax",path:"/yonetim",maxAge});
  return {ok:true};
 }catch(error){console.error("Admin password change unavailable",{code:typeof error === "object" && error && "code" in error?String(error.code):"unknown"});return {error:"Şifre değişikliği doğrulanamadı. Yeniden giriş yapman gerekirse yeni şifreni dene."};}
}

const validId=(id:string)=>typeof id==="string"&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
export async function updateParticipant(id:string,category:string,active:boolean){
 if(!await currentAdmin())return {error:"Yeniden giriş yap."};
 if(!validId(id)||!["paid","team","guest"].includes(category)||typeof active!=="boolean")return {error:"Geçersiz kayıt."};
 try{
 await guestDb().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(19092026)`;
  await sql`UPDATE guest_event.tickets SET category=${category},active=${active} WHERE id=${id}`;
  if(!active){
   await sql`DELETE FROM guest_event.sessions WHERE ticket_id=${id}`;
   await sql`DELETE FROM guest_event.reservations WHERE ticket_id=${id}`;
   await sql`UPDATE guest_event.plans SET data=jsonb_set(jsonb_set(data,'{slot}','""'::jsonb),'{selected}','[]'::jsonb),updated_at=now() WHERE ticket_id=${id}`;
  }
 });return {ok:true};
 }catch{return {error:"Katılımcı güncellenemedi."};}
}
export async function manageFortune(slot:string,enabled:boolean,ticketId:string|null,expectedTicketId:string|null){
 if(!await currentAdmin())return {error:"Yeniden giriş yap."};
 if(!validFortuneTime(slot)||typeof enabled!=="boolean"||(ticketId!==null&&!validId(ticketId))||(expectedTicketId!==null&&!validId(expectedTicketId)))return {error:"Geçersiz saat veya katılımcı."};
 try{
 await guestDb().begin(async sql=>{
  await sql`SELECT pg_advisory_xact_lock(19092026)`;
  const id="fortune-"+slot;
  const [window]=await sql`SELECT id FROM guest_event.workshops WHERE id=${id}`;
  if(!window)throw new Error("Bu saat kaldırılmış. Listeyi yenileyip tekrar dene.");
  const current=await sql`SELECT ticket_id FROM guest_event.reservations WHERE workshop_id=${id}`;
  if((current[0]?.ticket_id??null)!==expectedTicketId)throw new Error("Bu saat az önce değişti. Listeyi yenileyip tekrar dene.");
  if(ticketId){
   const [guest]=await sql`SELECT t.active,t.is_demo,p.data FROM guest_event.tickets t LEFT JOIN guest_event.plans p ON p.ticket_id=t.id WHERE t.id=${ticketId}`;
   if(!guest?.active||guest.is_demo||!guest.data)throw new Error("Önce planını doldurmuş aktif bir katılımcı seç.");
   if(!enabled)throw new Error("Kapalı saate rezervasyon atanamaz.");
   if(conflictingWorkshop(guest.data.selected,slot))throw new Error("Bu saat kişinin seçtiği atölyeyle çakışıyor.");
   await sql`DELETE FROM guest_event.reservations WHERE ticket_id=${ticketId} AND workshop_id LIKE 'fortune-%'`;
  }
  await sql`UPDATE guest_event.plans SET data=jsonb_set(data,'{slot}','""'::jsonb),updated_at=now() WHERE ticket_id IN (SELECT ticket_id FROM guest_event.reservations WHERE workshop_id=${id})`;
  await sql`DELETE FROM guest_event.reservations WHERE workshop_id=${id}`;
  if(ticketId){
   await sql`INSERT INTO guest_event.reservations(ticket_id,workshop_id) VALUES(${ticketId},${id})`;
   await sql`UPDATE guest_event.plans SET data=jsonb_set(data,'{slot}',${sql.json(slot)}),updated_at=now() WHERE ticket_id=${ticketId}`;
  }
  await sql`UPDATE guest_event.workshops SET enabled=${enabled} WHERE id=${id}`;
 });return {ok:true};
 }catch(e){return {error:e instanceof Error?e.message:"Saat güncellenemedi."};}
}

export async function changeFortuneSchedule(operation:"add"|"remove",slot:string){
 if(!await currentAdmin())return {error:"Yeniden giriş yap."};
 if(!["add","remove"].includes(operation)||!validFortuneTime(slot))return {error:"14:00–23:45 arasında, 15 dakikalık aralıklarla bir saat seç."};
 try{
  await guestDb().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(19092026)`;
   const id="fortune-"+slot;
   if(operation==="add"){
    const existing=await sql`SELECT id FROM guest_event.workshops WHERE id=${id}`;
    if(existing.length)throw new Error("Bu saat zaten programda var.");
    const [total]=await sql`SELECT count(*)::int AS count FROM guest_event.workshops WHERE id LIKE 'fortune-%'`;
    if(total.count>=FORTUNE_MAX_SLOTS)throw new Error("En fazla 14 seans (3,5 saat) olabilir. Önce boş bir saati kaldır.");
    await sql`INSERT INTO guest_event.workshops(id,capacity,enabled) VALUES(${id},1,true)`;
   }else{
    const reservations=await sql`SELECT ticket_id FROM guest_event.reservations WHERE workshop_id=${id}`;
    if(reservations.length)throw new Error("Bu saatte rezervasyon var. Önce rezervasyonu taşı veya kaldır.");
    await sql`UPDATE guest_event.plans SET data=jsonb_set(data,'{slot}','""'::jsonb),updated_at=now() WHERE data->>'slot'=${slot}`;
    await sql`DELETE FROM guest_event.workshops WHERE id=${id}`;
   }
  });return {ok:true};
 }catch(e){return {error:e instanceof Error?e.message:"Saat değiştirilemedi."};}
}

export async function removeWorkshopParticipant(workshopId:string,ticketId:string){
 if(!await currentAdmin())return {error:"Yönetim oturumun sona erdi. Yeniden giriş yap."};
 if(!["sound","scent","style"].includes(workshopId)||!validId(ticketId))return {error:"Geçersiz atölye veya katılımcı."};
 try{
  await guestDb().begin(async sql=>{
   await sql`SELECT pg_advisory_xact_lock(19092026)`;
   await sql`DELETE FROM guest_event.reservations WHERE workshop_id=${workshopId} AND ticket_id=${ticketId}`;
   await sql`UPDATE guest_event.plans SET data=jsonb_set(data,'{selected}',COALESCE(data->'selected','[]'::jsonb)-${workshopId}::text),updated_at=now() WHERE ticket_id=${ticketId} AND data->'selected' ? ${workshopId}`;
  });
  return {ok:true};
 }catch{return {error:"Katılımcı atölyeden çıkarılamadı. Tekrar dene."};}
}
