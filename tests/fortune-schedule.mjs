import assert from "node:assert/strict";
import{readFileSync}from"node:fs";
import{randomBytes,createHash}from"node:crypto";
import postgres from"postgres";
const sql=postgres(process.env.POSTGRES_URL,{ssl:"require",max:1});
const base=process.env.TEST_BASE_URL||"http://localhost:3010";
const manifest=JSON.parse(readFileSync(process.env.TEST_BUILD_DIR+"/.next/server/server-reference-manifest.json","utf8"));
const ids=Object.fromEntries(Object.entries(manifest.node).map(([id,v])=>[v.exportedName,id]));
const token=randomBytes(32).toString("hex"),hash=x=>createHash("sha256").update(x).digest("hex");
let ticketId,created=false;
async function action(name,args,auth=true){
 const r=await fetch(base+"/yonetim",{method:"POST",headers:{"Next-Action":ids[name],Origin:base,"Content-Type":"text/plain",...(auth?{Cookie:"soul_admin_session="+token}:{})},body:JSON.stringify(args)});
 return await r.text();
}
try{
 const [admin]=await sql`SELECT id FROM guest_event.admins WHERE active LIMIT 1`;
 await sql`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${admin.id},now()+interval '5 minutes')`;
 assert.match(await action("changeFortuneSchedule",["add","23:45"],false),/Yeniden giriş/);
 assert.match(await action("changeFortuneSchedule",["add","23:46"]),/15 dakikalık/);
 if(process.env.TEST_CAP_ONLY){
  assert.match(await action("changeFortuneSchedule",["add","23:45"]),/En fazla 14/);
  console.log("PASS: maximum 14 sessions enforced server-side.");
 }else{
  const existing=await sql`SELECT id FROM guest_event.workshops WHERE id='fortune-23:45'`;assert.equal(existing.length,0);
  assert.match(await action("changeFortuneSchedule",["add","23:45"]),/"ok":true/);created=true;
  assert.match(await action("changeFortuneSchedule",["add","23:45"]),/zaten/);
  const [ticket]=await sql`INSERT INTO guest_event.tickets(name,code_hash) VALUES('TEST schedule',${hash(token+"guest")}) RETURNING id`;ticketId=ticket.id;
  const plan={selected:[],slot:"",transport:"Henüz belli değil",origin:"",arrival:"",party:"1",allergy:"Yok",allergyNote:"",diet:"Özel bir tercihim yok",note:"",consent:true};
  await sql`INSERT INTO guest_event.plans(ticket_id,data) VALUES(${ticketId},${sql.json(plan)})`;
  assert.match(await action("manageFortune",["23:45",true,ticketId,null]),/"ok":true/);
  assert.match(await action("changeFortuneSchedule",["remove","23:45"]),/rezervasyon var/);
  assert.match(await action("manageFortune",["23:45",true,null,ticketId]),/"ok":true/);
  assert.match(await action("changeFortuneSchedule",["remove","23:45"]),/"ok":true/);created=false;
  assert.match(await action("manageFortune",["23:45",true,null,null]),/kaldırılmış/);
  console.log("PASS: auth, valid times, dynamic addition, duplicate protection, booking protection, release/removal, stale edit protection.");
 }
}finally{
 if(ticketId)await sql`DELETE FROM guest_event.tickets WHERE id=${ticketId}`;
 if(created)await sql`DELETE FROM guest_event.workshops WHERE id='fortune-23:45'`;
 await sql`DELETE FROM guest_event.admin_sessions WHERE token_hash=${hash(token)}`;
 await sql.end();
}
