import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');

  const query = muxId
    ? `SELECT * FROM psi_si_tables WHERE mux_id=? ORDER BY table_type`
    : `SELECT p.*, m.name as mux_name FROM psi_si_tables p JOIN multiplexes m ON m.id=p.mux_id ORDER BY m.number, p.table_type`;
  const rows = muxId ? db.prepare(query).all(muxId) : db.prepare(query).all();
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const db = getDb();
  const body = await req.json(); // { id, cycle_ms, enabled, version }
  db.prepare(`UPDATE psi_si_tables SET cycle_ms=@cycle_ms, enabled=@enabled, version=@version, updated_at=datetime('now') WHERE id=@id`).run(body);
  const row = db.prepare('SELECT * FROM psi_si_tables WHERE id=?').get(body.id);
  return NextResponse.json(row);
}
