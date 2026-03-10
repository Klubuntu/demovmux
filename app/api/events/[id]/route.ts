import { dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbRun(`UPDATE events SET resolved=1, resolved_at=CURRENT_TIMESTAMP WHERE id=?`, [id]);
  const row = await dbGet('SELECT * FROM events WHERE id = ?', [id]);
  return NextResponse.json(row);
}
