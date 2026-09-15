import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{randomBytes,randomUUID,createHash}from'node:crypto';
import postgres from'postgres';
const sql=postgres(process.env.POSTGRES_URL,{ssl:'require',max:1});
const base=process.env.TEST_BASE_URL||'http://localhost:3007';
const manifest=JSON.parse(readFileSync(process.env.TEST_BUILD_DIR+'/.next/server/server-reference-manifest.json','utf8'));
const ids=Object.fromEntries(Object.entries(manifest.node).map(([id,v])=>[v.exportedName,id]));
const token=randomBytes(32).toString('hex'),hash=x=>createHash('sha256').update(x).digest('hex');
const requestId=randomUUID();let ticketId;
async function action(name,args,auth=true){
 const r=await fetch(base+'/yonetim',{method:'POST',headers:{'Next-Action':ids[name],Origin:base,'Content-Type':'text/plain',...(auth?{Cookie:'soul_admin_session='+token}:{})},body:JSON.stringify(args)});
 return await r.text();
}
try{
 const [admin]=await sql`SELECT id FROM guest_event.admins WHERE active LIMIT 1`;
 await sql`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${admin.id},now()+interval '5 minutes')`;
 assert.match(await action('manageFortune',['22:00',true,null,null],false),/Yeniden giriş/);
 assert.match(await action('issueGuest',['TEST management',false,requestId,'team']),/"code":"[1-9][0-9]{4}"/);
 const [t]=await sql`SELECT id,category FROM guest_event.tickets WHERE issue_request_id=${requestId}`;ticketId=t.id;assert.equal(t.category,'team');
 const data={selected:[],slot:'',transport:'Henüz belli değil',origin:'',arrival:'',party:'1',allergy:'Yok',allergyNote:'',diet:'Özel bir tercihim yok',note:'',consent:true};
 await sql`INSERT INTO guest_event.plans(ticket_id,data) VALUES(${t.id},${sql.json(data)})`;
 const [free]=await sql`SELECT w.id FROM guest_event.workshops w WHERE w.id LIKE 'fortune-%' AND w.enabled AND NOT EXISTS(SELECT 1 FROM guest_event.reservations r WHERE r.workshop_id=w.id) ORDER BY w.id DESC LIMIT 1`;
 assert.ok(free);const slot=free.id.replace('fortune-','');
 assert.match(await action('manageFortune',[slot,true,t.id,null]),/"ok":true/);
 let [p]=await sql`SELECT data FROM guest_event.plans WHERE ticket_id=${t.id}`;assert.equal(p.data.slot,slot);
 assert.match(await action('manageFortune',[slot,true,null,null]),/az önce değişti/);
 assert.match(await action('manageFortune',[slot,true,null,t.id]),/"ok":true/);
 [p]=await sql`SELECT data FROM guest_event.plans WHERE ticket_id=${t.id}`;assert.equal(p.data.slot,'');
 assert.match(await action('manageFortune',[slot,true,t.id,null]),/"ok":true/);
 assert.match(await action('updateParticipant',[t.id,'guest',false]),/"ok":true/);
 const [state]=await sql`SELECT active,category,(SELECT count(*)::int FROM guest_event.reservations WHERE ticket_id=${t.id}) AS booked FROM guest_event.tickets WHERE id=${t.id}`;
 assert.equal(state.active,false);assert.equal(state.category,'guest');assert.equal(state.booked,0);
 assert.match(await action('updateParticipant',[t.id,'guest',true]),/"ok":true/);
 console.log('PASS: auth, team issuance, slot assignment/release, stale update protection, category update, removal frees seats, restore.');
}finally{
 if(ticketId)await sql`DELETE FROM guest_event.tickets WHERE id=${ticketId}`;
 await sql`DELETE FROM guest_event.admin_sessions WHERE token_hash=${hash(token)}`;
 await sql.end();
}
