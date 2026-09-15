import "server-only";
import postgres from "postgres";

let connection: ReturnType<typeof postgres> | undefined;

export function guestDb() {
  if (!process.env.POSTGRES_URL)
    throw new Error("Guest database is not configured");
  return (connection ??= postgres(process.env.POSTGRES_URL, {
    ssl: "require",
    max: 3,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  }));
}

export class UserError extends Error {}

export function withEventLock<T>(
  fn: (sql: postgres.TransactionSql) => Promise<T>,
) {
  return guestDb().begin(async (sql) => {
    await sql`SELECT pg_advisory_xact_lock(19092026)`;
    return fn(sql);
  }) as Promise<T>;
}
