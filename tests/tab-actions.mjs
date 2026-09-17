// Adisyon server actions: role permissions and tab rules against a real database.
// Requires a production build (`pnpm build`), a running server (`pnpm start -p 3006`)
// and POSTGRES_URL. Creates clearly labelled TEST records and removes them afterwards.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import postgres from 'postgres';
const base=process.env.TEST_BASE_URL||'http://localhost:3006';
const manifest=JSON.parse(readFileSync((process.env.TEST_BUILD_DIR||'.')+'/.next/server/server-reference-manifest.json','utf8'));
const ids=Object.fromEntries(Object.entries(manifest.node).map(([id,x])=>[x.exportedName,id]));
async function action(name,args,cookie=''){
 const r=await fetch(base+'/yonetim/adisyon',{method:'POST',headers:{'Next-Action':ids[name],'Content-Type':'text/plain;charset=UTF-8',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(args)});
 return {status:r.status,body:await r.text()};
}
const uuid=body=>body.match(/"id":"([a-f0-9-]{36})"/)?.[1];
const sql=postgres(process.env.POSTGRES_URL,{ssl:'require',max:1});const hash=x=>createHash('sha256').update(x).digest('hex');
const tag=randomUUID().slice(0,8);const created={admins:[],guests:[],accounts:[]};
async function staff(role){
 const [a]=await sql`INSERT INTO guest_event.admins(name,code_hash,role) VALUES(${'TEST '+role+' '+tag},${hash(randomBytes(16).toString('hex'))},${role}) RETURNING id`;
 const token=randomBytes(32).toString('hex');
 await sql`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${a.id},now()+interval '1 hour')`;
 created.admins.push(a.id);return {id:a.id,cookie:'soul_admin_session='+token};
}
try{
 const anon=await action('getTabData',[]);assert.ok(!anon.body.includes('"menu"'),'anonymous read must be refused');
 assert.ok((await action('addTabGuest',['TEST anon '+tag])).body.includes('Oturumun sona erdi'));
 const bar=await staff('bar'),pizza=await staff('pizza'),admin=await staff('admin');
 // Bar staff see the module but never the organiser console or admin-only actions.
 const barData=await action('getTabData',[],bar.cookie);assert.ok(barData.body.includes('"menu"'));assert.ok((await action('getStaffAccounts',[],bar.cookie)).body.includes('yönetici yetkisi'),'staff codes are admin only');
 assert.ok(!(await action('getAdminData',[],bar.cookie)).body.includes('"workshops"'),'bar must not read the organiser console');
 for(const [name,args] of [['saveMenu',[[]]],['saveBankAccounts',[[]]],['addTabGuestsBulk',['TEST']],['createStaffAccount',['TEST x','bar']]])
  assert.ok((await action(name,args,bar.cookie)).body.includes('yönetici yetkisi'),name+' must be admin only');
 // Guest and lines.
 // Readable staff codes: created, listed, renewed, and usable for login.
 const createdStaff=await action('createStaffAccount',['TEST kod '+tag,'pizza'],admin.cookie);const code=createdStaff.body.match(/"code":"([A-Z2-9]{3}-[A-Z2-9]{3})"/)?.[1];assert.ok(code,'staff code is created');
 const staffId=uuid(createdStaff.body);created.admins.push(staffId);
 assert.ok((await action('getStaffAccounts',[],admin.cookie)).body.includes(code),'admin can read the code back');
 const codeLogin=await fetch(base+'/yonetim',{method:'POST',headers:{'Next-Action':ids.loginAdmin,'Content-Type':'text/plain;charset=UTF-8',Origin:base},body:JSON.stringify([code.toLowerCase(),false])});
 assert.ok(codeLogin.headers.getSetCookie().some(c=>c.startsWith('soul_admin_session=')),'lower-case code with dash signs in');
 const renewed=await action('regenerateStaffCode',[staffId],admin.cookie);const code2=renewed.body.match(/"code":"([A-Z2-9]{3}-[A-Z2-9]{3})"/)?.[1];assert.ok(code2&&code2!==code,'renewal changes the code');
 const guest=uuid((await action('addTabGuest',['TEST misafir '+tag],bar.cookie)).body);assert.ok(guest);created.guests.push(guest);
 const [bira]=await sql`SELECT id,name,price FROM guest_event.menu_items WHERE active AND station='bar' ORDER BY sort_order LIMIT 1`;
 const [pizzaItem]=await sql`SELECT id,price FROM guest_event.menu_items WHERE active AND station='pizza' ORDER BY sort_order LIMIT 1`;
 assert.ok(bira&&pizzaItem,'seed menu required');
 const line1=uuid((await action('addTabLine',[guest,bira.id],bar.cookie)).body);assert.ok(line1);
 const line2=uuid((await action('addTabLine',[guest,bira.id],bar.cookie)).body);assert.ok(line2&&line2!==line1,'each add creates a new row');
 const line3=uuid((await action('addTabLine',[guest,pizzaItem.id],pizza.cookie)).body);assert.ok(line3);
 const snapshot=await sql`SELECT name,price,station FROM guest_event.tab_lines WHERE id=${line1}`;assert.equal(snapshot[0].name,bira.name);assert.equal(snapshot[0].price,bira.price);
 assert.ok((await action('deleteTabGuest',[guest],bar.cookie)).body.includes('yönetici yetkisi'),'guest deletion is admin only');
 // Deletion rights: owner or admin.
 assert.ok((await action('deleteTabLine',[line1],pizza.cookie)).body.includes('Sadece kalemi giren'));
 assert.ok((await action('deleteTabLine',[line1],bar.cookie)).body.includes('"ok":true'));
 assert.ok((await action('deleteTabLine',[line3],admin.cookie)).body.includes('"ok":true'));
 const [audit]=await sql`SELECT count(*)::int AS n FROM guest_event.tab_audit WHERE action='line.delete' AND guest_id=${guest}`;assert.equal(audit.n,2,'deletions are logged');
 // Close rules.
 const total=bira.price;
 assert.ok((await action('closeTabGuest',[guest],bar.cookie)).body.includes('Kalan borç varken'));
 const partial=await action('addTabPayment',[guest,100,'pos'],bar.cookie);assert.ok(partial.body.includes('"status":"open"'));
 // IBAN payments must say which account they went to.
 assert.ok((await action('addTabPayment',[guest,null,'iban',null],pizza.cookie)).body.includes('Hangi IBAN'));
 assert.ok((await action('saveBankAccounts',[[{id:null,label:'TEST hesap '+tag,iban:'TR00 0000 0000 0000 0000 0000 00',active:true}]],admin.cookie)).body.includes('"ok":true'));
 const [accountRow]=await sql`SELECT id FROM guest_event.bank_accounts WHERE label=${'TEST hesap '+tag}`;created.accounts.push(accountRow.id);
 const rest=await action('addTabPayment',[guest,null,'iban',accountRow.id],pizza.cookie);assert.ok(rest.body.includes('"status":"closed"'),'paying the balance closes the tab');assert.ok(rest.body.includes('TEST hesap '+tag),'payment carries the account label');
 const [stored]=await sql`SELECT bank_account_id FROM guest_event.tab_payments WHERE guest_id=${guest} AND method='iban'`;assert.equal(stored.bank_account_id,accountRow.id);
 const paid=await sql`SELECT sum(amount)::int AS s FROM guest_event.tab_payments WHERE guest_id=${guest}`;assert.equal(paid[0].s,total);
 assert.ok((await action('addTabPayment',[guest,null,'cash'],bar.cookie)).body.includes('kalan borç yok'));
 const reopened=await action('addTabLine',[guest,bira.id],bar.cookie);assert.ok(reopened.body.includes('"status":"open"'),'adding to a closed tab reopens it');
 const [status]=await sql`SELECT status FROM guest_event.tab_guests WHERE id=${guest}`;assert.equal(status.status,'open');
 await action('addTabPayment',[guest,null,'cash'],bar.cookie);
 const ibanPayment=uuid(rest.body);assert.ok((await action('deleteTabPayment',[ibanPayment],bar.cookie)).body.includes('Sadece ödemeyi alan'));
 assert.ok((await action('deleteTabPayment',[ibanPayment],pizza.cookie)).body.includes('"ok":true'));
 const [after]=await sql`SELECT status FROM guest_event.tab_guests WHERE id=${guest}`;assert.equal(after.status,'open','removing a payment that leaves a balance reopens the tab');
 assert.ok((await action('deleteTabGuest',[guest],admin.cookie)).body.includes('"ok":true'));
 const [gone]=await sql`SELECT count(*)::int AS n FROM guest_event.tab_lines WHERE guest_id=${guest}`;assert.equal(gone.n,0);
 console.log('PASS: anonymous denied, bar/pizza limited to the module, admin-only settings, readable staff codes (create/list/login/renew), new row per add with price snapshot, owner/admin deletion with audit log, close/reopen rules.');
}finally{
 for(const g of created.guests)await sql`DELETE FROM guest_event.tab_guests WHERE id=${g}`;
 for(const a of created.accounts)await sql`DELETE FROM guest_event.bank_accounts WHERE id=${a}`;
 await sql`DELETE FROM guest_event.tab_audit WHERE actor_id=ANY(${created.admins}::uuid[])`;
 for(const a of created.admins)await sql`DELETE FROM guest_event.admins WHERE id=${a}`;
 await sql.end();
}
