import { Client } from "pg";

type DbStatus = { ok: boolean; message: string };

export async function checkDb(): Promise<DbStatus> {
  const conn = process.env.DATABASE_URL;
  if (!conn) return { ok: false, message: "DATABASE_URL not set" };

  const client = new Client({ connectionString: conn, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return { ok: true, message: "Connected" };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { ok: false, message: err?.message ?? String(err) };
  }
}