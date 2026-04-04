import { NextResponse } from "next/server";
import { checkDb } from "../../../lib/db";

export async function GET() {
  const status = await checkDb();
  return NextResponse.json(status);
}