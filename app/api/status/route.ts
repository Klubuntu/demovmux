import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getDb();
  const status = db.prepare('SELECT * FROM service_status WHERE id=1').get();
  return NextResponse.json(status);
}

export async function PUT(req: Request) {
  const db = getDb();
  const { status, message } = await req.json();
  db.prepare(`UPDATE service_status SET status=?, message=?, updated_at=datetime('now') WHERE id=1`).run(status, message ?? null);
  const row = db.prepare('SELECT * FROM service_status WHERE id=1').get();
  return NextResponse.json(row);
}
