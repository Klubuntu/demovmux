import { dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const status = await dbGet('SELECT * FROM service_status WHERE id=1');
  return NextResponse.json(status);
}

export async function PUT(req: Request) {
  const { status, message } = await req.json();
  await dbRun(`UPDATE service_status SET status=?, message=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`, [status, message ?? null]);
  const row = await dbGet('SELECT * FROM service_status WHERE id=1');
  return NextResponse.json(row);
}
