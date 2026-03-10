import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT s.*, m.name as mux_name FROM sfn_nodes s JOIN multiplexes m ON m.id=s.mux_id WHERE s.id=?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  db.prepare(`
    UPDATE sfn_nodes SET mux_id=@mux_id, name=@name, location=@location, latitude=@latitude,
    longitude=@longitude, power_w=@power_w, antenna_height_m=@antenna_height_m,
    frequency_mhz=@frequency_mhz, mip_enabled=@mip_enabled, gps_sync=@gps_sync,
    delay_us=@delay_us, status=@status, updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...body, id });
  const row = db.prepare('SELECT * FROM sfn_nodes WHERE id = ?').get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM sfn_nodes WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
