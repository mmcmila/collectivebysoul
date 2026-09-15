// Run against a local production build with POSTGRES_URL and TEST_BUILD_DIR set.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import postgres from 'postgres';
const sql=postgres(process.env.POSTGRES_URL,{ssl:'require',max:1});
const base=process.env.TEST_BASE_URL||'http://localhost:3007';
const manifest=JSON.parse(readFileSync((process.env.TEST_BUILD_DIR||process.cwd())+'/.next/server/server-reference-manifest.json','utf8'));
const ids=Object.fromEntries(Object.entries(manifest.node).map(([id,v])=>[v.exportedName,id]));
const token=randomBytes(32).toString('hex');
const hash=value=>createHash('sha256').update(value).digest('hex');
let ticketId;
async function action(name,args,auth=true){
 const response=await fetch(base+'/yonetim',{method:'POST',headers:{'Next-Action':ids[name],Origin:base,'Content-Type':'text/plain',...(auth?{Cookie:'soul_admin_session='+token}:{})},body:JSON.stringify(args)});
 return response.text();
}
try{
 const [admin]=await sql`SELECT id FROM guest_event.admins WHERE active LIMIT 1`;
 await sql`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${admin.id},now()+interval '5 minutes')`;
 // Temporary demo fixture is excluded from real attendee counts and removed in finally.
 const [ticket]=await sql`INSERT INTO guest_event.tickets(name,code_hash,is_demo) VALUES('TEST workshop removal',${hash(randomBytes(32))},true) RETURNING id`;
 ticketId=ticket.id;
 const plan={selected:['sound','scent'],slot:'',note:'Preserve this note',consent:true};
 await sql`INSERT INTO guest_event.plans(ticket_id,data) VALUES(${ticketId},${sql.json(plan)})`;
 assert.match(await action('removeWorkshopParticipant',['sound',ticketId],false),/Yönetim oturumun/);
 assert.match(await action('removeWorkshopParticipant',['fortune-16:30',ticketId]),/Geçersiz/);
 assert.match(await action('removeWorkshopParticipant',['sound','bad-id']),/Geçersiz/);
 await sql`INSERT INTO guest_event.reservations(ticket_id,workshop_id) VALUES(${ticketId},'sound') ON CONFLICT DO NOTHING`;
 assert.match(await action('removeWorkshopParticipant',['sound',ticketId]),/"ok":true/);
 assert.match(await action('removeWorkshopParticipant',['sound',ticketId]),/"ok":true/);
 const [saved]=await sql`SELECT p.data,t.active FROM guest_event.plans p JOIN guest_event.tickets t ON t.id=p.ticket_id WHERE t.id=${ticketId}`;
 assert.deepEqual(saved.data,{...plan,selected:['scent']});
 assert.equal(saved.active,true);
 const [reservation]=await sql`SELECT count(*)::int AS count FROM guest_event.reservations WHERE ticket_id=${ticketId}`;
 assert.equal(reservation.count,0);
 console.log('PASS: authentication, input validation, reservation release, plan update, repeat removal, other selections and active ticket preserved.');
}finally{
 if(ticketId)await sql`DELETE FROM guest_event.tickets WHERE id=${ticketId}`;
 await sql`DELETE FROM guest_event.admin_sessions WHERE token_hash=${hash(token)}`;
 await sql.end();
}
