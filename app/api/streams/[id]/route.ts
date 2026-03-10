import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM input_streams WHERE id = ?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  db.prepare(`
    UPDATE input_streams SET name=@name, broadcaster=@broadcaster, type=@type, protocol=@protocol,
    source_address=@source_address, source_port=@source_port, bitrate_mbps=@bitrate_mbps,
    redundancy_mode=@redundancy_mode, encryption=@encryption, status=@status,
    updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...body, id });
  const row = db.prepare('SELECT * FROM input_streams WHERE id = ?').get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM input_streams WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
