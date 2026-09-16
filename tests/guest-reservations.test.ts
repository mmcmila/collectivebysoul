import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { guestDb } from '../lib/guest/db';
import { persistGuestPlan } from '../lib/guest/reservations';
import type { GuestPlan } from '../lib/guest/types';

test('seat transactions: concurrency, release, rollback, demo and revocation', async () => {
 const sql=guestDb(); const prefix=`test-${randomUUID()}`; const one=prefix+'-one'; const two=prefix+'-two';
 const tickets: {id:string;is_demo:boolean}[]=[];
 const plan=(ids:string[]):GuestPlan=>({transport:'Vapur / motor',origin:'TEST',arrival:'',party:'1',selected:ids,slot:'',allergy:'Yok',allergyNote:'',diet:'Özel bir tercihim yok',note:'',consent:true});
 try {
  await sql`INSERT INTO guest_event.workshops(id,capacity,enabled) VALUES (${one},1,true),(${two},1,true)`;
  for(let i=0;i<3;i++){const [t]=await sql`INSERT INTO guest_event.tickets(name,code_hash,is_demo) VALUES (${prefix},${randomUUID()},${i===2}) RETURNING id,is_demo`; tickets.push(t as {id:string;is_demo:boolean});}
  const attempts=await Promise.allSettled(tickets.slice(0,2).map(t=>persistGuestPlan(t,plan([one]))));
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1,'exactly one person gets the last place');
  const winner=tickets[attempts.findIndex(a=>a.status==='fulfilled')];const loser=tickets[attempts.findIndex(a=>a.status==='rejected')];
  await persistGuestPlan(winner,plan([one])); // Idempotent re-save does not count twice.
  let [count]=await sql`SELECT count(*)::int AS n FROM guest_event.reservations WHERE workshop_id=${one}`;assert.equal(count.n,1);
  await persistGuestPlan(loser,plan([two]));
  await assert.rejects(persistGuestPlan(winner,plan([two])));
  const [unchanged]=await sql`SELECT data FROM guest_event.plans WHERE ticket_id=${winner.id}`;assert.deepEqual(unchanged.data.selected,[one]);
  await persistGuestPlan(winner,plan([]));
  await persistGuestPlan(loser,plan([one]));
  [count]=await sql`SELECT count(*)::int AS n FROM guest_event.reservations WHERE workshop_id=${two}`;assert.equal(count.n,0,'changing choices releases the previous seat');
  await persistGuestPlan(tickets[2],plan([two]));
  [count]=await sql`SELECT count(*)::int AS n FROM guest_event.reservations WHERE ticket_id=${tickets[2].id}`;assert.equal(count.n,0,'demo never occupies real seats');
  await sql`UPDATE guest_event.tickets SET active=false WHERE id=${winner.id}`;
  await assert.rejects(persistGuestPlan(winner,plan([])));
 } finally {
  await sql`DELETE FROM guest_event.tickets WHERE name=${prefix}`;
  await sql`DELETE FROM guest_event.workshops WHERE id IN (${one},${two})`;
  await sql.end();
 }
});
