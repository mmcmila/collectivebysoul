// Requires a running local production build, .env.local, and the local owner access file.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
const base=process.env.TEST_BASE_URL||'http://localhost:3004';
const manifest=JSON.parse(readFileSync((process.env.TEST_BUILD_DIR||'.')+'/.next/server/server-reference-manifest.json','utf8'));
const ids=Object.fromEntries(Object.entries(manifest.node).map(([id,x])=>[x.exportedName,id]));
async function action(name,args,cookie=''){
 const r=await fetch(base+(name==='loginGuest'?'/misafir':'/yonetim'),{method:'POST',headers:{'Next-Action':ids[name],'Content-Type':'text/plain;charset=UTF-8','Origin':base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(args)});
 return {status:r.status,body:await r.text(),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};
}
const requestId=randomUUID();const name='TEST admin '+requestId;const sql=postgres(process.env.POSTGRES_URL,{ssl:'require',max:1});
try{
 const unauth=await action('getAdminData',[]);assert.ok([200,303,500].includes(unauth.status));assert.ok(!unauth.body.includes('"guests"'));
 const refused=await action('issueGuest',[name,true,requestId]);assert.ok(refused.body.includes('Yönetim oturumun sona erdi'));
 const [guest]=await sql`SELECT t.code_hash FROM guest_event.tickets t WHERE t.is_demo LIMIT 1`;
 assert.ok(guest);
 const wrong=await action('loginAdmin',['NOT-AN-ADMIN-CODE']);assert.ok(wrong.body.includes('geçersiz'));
 const code=readFileSync('tmp/yonetim-giris.txt','utf8').match(/[A-F0-9]{4}(?:-[A-F0-9]{4}){7}/)[0];
 const login=await action('loginAdmin',[code]);assert.ok(login.cookie.includes('soul_admin_session='));
 const data=await action('getAdminData',[],login.cookie);assert.equal(data.status,200);assert.ok(data.body.includes('"guests"'));
 const noPayment=await action('issueGuest',[name,false,requestId],login.cookie);assert.ok(noPayment.body.includes('ödeme onayını'));
 const first=await action('issueGuest',[name,true,requestId],login.cookie);assert.ok(first.body.includes('"code"'));
 const shortCode=first.body.match(/"code":"([1-9][0-9]{4})"/)?.[1];assert.ok(shortCode,'new guest code must be five digits');
 const guestLogin=await action('loginGuest',[shortCode]);assert.ok(guestLogin.cookie.includes('soul_guest_session='),guestLogin.body.replace(/[A-Fa-f0-9]{20,}/g,'[redacted]'));
 const duplicate=await action('issueGuest',[name,true,requestId],login.cookie);assert.ok(duplicate.body.includes('ikinci bir bilet oluşturulmadı'));
 const [count]=await sql`SELECT count(*)::int AS n FROM guest_event.tickets WHERE issue_request_id=${requestId}`;assert.equal(count.n,1);
 const logout=await action('logoutAdmin',[],login.cookie);assert.ok(logout.status<400);
 const expired=await action('getAdminData',[],login.cookie);assert.ok(!expired.body.includes('"guests"'));
 console.log('PASS: anonymous read/issuance denied, invalid login denied, admin login/read, payment confirmation, duplicate protection, logout revokes session.');
}finally{await sql`DELETE FROM guest_event.tickets WHERE issue_request_id=${requestId}`;await sql.end();}
