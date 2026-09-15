// Run with node --env-file=.env.local scripts/guest-admin.mjs ...
import postgres from "postgres";
import { randomInt, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const sql = postgres(process.env.POSTGRES_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});
const [command, ...args] = process.argv.slice(2);
try {
  if (command === "migrate") {
    await sql.unsafe(
      readFileSync(new URL("../db/guest.sql", import.meta.url), "utf8"),
    );
    console.log(
      "Guest schema ready. Workshops remain closed until capacities are confirmed.",
    );
  } else if (
    command === "issue" &&
    args[0] &&
    ["--paid", "--demo"].includes(args[1])
  ) {
    let issued = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = String(randomInt(10000, 100000));
      const [ticket] =
        await sql`INSERT INTO guest_event.tickets (name,code_hash,is_demo) VALUES (${args[0]},${createHash("sha256").update(code).digest("hex")},${args[1] === "--demo"}) ON CONFLICT(code_hash) DO NOTHING RETURNING id`;
      if (ticket) {
        console.log(
          JSON.stringify(
            {
              id: ticket.id,
              name: args[0],
              code,
              url: "https://collectivebysoul.com/misafir",
            },
            null,
            2,
          ),
        );
        issued = true;
        break;
      }
    }
    if (!issued) throw new Error("Could not allocate a unique code; retry.");
  } else if (
    command === "capacity" &&
    args[0] &&
    /^(open|[1-9][0-9]?)$/.test(args[1])
  ) {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(19092026)`;
      const capacity = args[1] === "open" ? null : Number(args[1]);
      const [count] =
        await tx`SELECT count(*)::int AS n FROM guest_event.reservations WHERE workshop_id=${args[0]}`;
      if (capacity !== null && count.n > capacity)
        throw new Error("Capacity is below current bookings");
      const rows =
        await tx`UPDATE guest_event.workshops SET capacity=${capacity}, enabled=true WHERE id=${args[0]} RETURNING id`;
      if (!rows.length) throw new Error("Unknown workshop");
    });
    console.log("Capacity updated.");
  } else if (command === "revoke" && args[0]) {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(19092026)`;
      await tx`UPDATE guest_event.tickets SET active=false WHERE id=${args[0]}`;
      await tx`DELETE FROM guest_event.sessions WHERE ticket_id=${args[0]}`;
      await tx`DELETE FROM guest_event.reservations WHERE ticket_id=${args[0]}`;
    });
    console.log("Code revoked and seats released.");
  } else
    throw new Error(
      'Usage: migrate | issue "Name" --paid/--demo | capacity workshop-id number/open | revoke ticket-uuid',
    );
} catch (e) {
  console.error(e.code || e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
