import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import postgres from 'postgres';
const base=process.env.TEST_BASE_URL||'http://localhost:3005';
const manifest=JSON.parse(readFileSync((process.env.TEST_BUILD_DIR||'.')+'/.next/server/server-reference-manifest.json','utf8'));
const ids=Object.fromEntries(Object.entries(manifest.node).map(([id,x])=>[x.exportedName,id]));
async function action(name,args,cookie=''){
 const r=await fetch(base+'/yonetim',{method:'POST',headers:{'Next-Action':ids[name],'Content-Type':'text/plain;charset=UTF-8',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(args)});
 const set=r.headers.getSetCookie();return {status:r.status,body:await r.text(),cookie:set.map(x=>x.split(';')[0]).join('; '),set};
}
const sql=postgres(process.env.POSTGRES_URL,{ssl:'require',max:1});const hash=x=>createHash('sha256').update(x).digest('hex');
const name='test-password-'+randomUUID();let adminId;
try{
 const code=readFileSync('tmp/yonetim-giris.txt','utf8').match(/[A-F0-9]{4}(?:-[A-F0-9]{4}){7}/)[0];
 const login=await action('loginAdmin',[code,true]);assert.ok(login.cookie.includes('soul_admin_session='));assert.ok(login.set.some(s=>/max-age=2592000/i.test(s)&&/samesite=lax/i.test(s)));
 const remembered=await action('getAdminData',[],login.cookie);assert.ok(remembered.body.includes('"guests"'));
 await action('logoutAdmin',[],login.cookie);
 const old=randomBytes(16).toString('hex').toUpperCase();const [a]=await sql`INSERT INTO guest_event.admins(name,code_hash) VALUES(${name},${hash(old)}) RETURNING id`;adminId=a.id;
 const token=randomBytes(32).toString('hex'),second=randomBytes(32).toString('hex');
 await sql`INSERT INTO guest_event.admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${a.id},now()+interval '1 hour'),(${hash(second)},${a.id},now()+interval '1 hour')`;
 const cookie='soul_admin_session='+token;const password='New-'+randomBytes(16).toString('hex')+'!';
 const denied=await action('changeAdminPassword',['wrong',password,true],cookie);assert.ok(denied.body.includes('doğru değil'));
 const changed=await action('changeAdminPassword',[old,password,true],cookie);assert.ok(changed.body.includes('"ok":true'));
 const [stored]=await sql`SELECT code_hash FROM guest_event.admins WHERE id=${a.id}`;const [,salt,key]=stored.code_hash.split(':');assert.equal(stored.code_hash.split(':')[0],'scrypt');assert.equal((await promisify(scryptCallback)(password,salt,64)).toString('hex'),key);
 const [count]=await sql`SELECT count(*)::int AS n FROM guest_event.admin_sessions WHERE admin_id=${a.id}`;assert.equal(count.n,1);
 const stale=await action('getAdminData',[],cookie);assert.ok(!stale.body.includes('"guests"'));
 const valid=await action('getAdminData',[],changed.cookie);assert.ok(valid.body.includes('"guests"'));
 const wrongCase=await action('changeAdminPassword',[password.toUpperCase(),'Another-password-123!',true],changed.cookie);assert.ok(wrongCase.body.includes('doğru değil'));
 console.log('PASS: 30-day cookie, link-friendly SameSite, current-password validation, scrypt storage, case sensitivity, other-session revocation, renewed session. Owner password unchanged.');
}finally{
 if(adminId){await sql`DELETE FROM guest_event.login_limits WHERE key=${'password-change:'+adminId}`;await sql`DELETE FROM guest_event.admins WHERE id=${adminId}`;}
 await sql.end();
}
