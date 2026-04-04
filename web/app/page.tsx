import { checkDb } from "../lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await checkDb();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Digitec Price Tracker</h1>
        <p
          className={`inline-block rounded-full px-4 py-2 text-sm font-medium ${
            status.ok
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {status.ok ? `DB: ${status.message}` : `DB Error: ${status.message}`}
        </p>
      </div>
    </div>
  );
}