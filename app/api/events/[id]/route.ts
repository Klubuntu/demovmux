import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare(`UPDATE events SET resolved=1, resolved_at=datetime('now') WHERE id=?`).run(id);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  return NextResponse.json(row);
}
