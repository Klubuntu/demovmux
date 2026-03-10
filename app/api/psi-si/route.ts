import { dbAll, dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');

  const query = muxId
    ? `SELECT * FROM psi_si_tables WHERE mux_id=? ORDER BY table_type`
    : `SELECT p.*, m.name as mux_name FROM psi_si_tables p JOIN multiplexes m ON m.id=p.mux_id ORDER BY m.number, p.table_type`;
  const rows = muxId ? await dbAll(query, [muxId]) : await dbAll(query);
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const body = await req.json(); // { id, cycle_ms, enabled, version }
  await dbRun(`UPDATE psi_si_tables SET cycle_ms=@cycle_ms, enabled=@enabled, version=@version, updated_at=CURRENT_TIMESTAMP WHERE id=@id`, body);
  const row = await dbGet('SELECT * FROM psi_si_tables WHERE id=?', [body.id]);
  return NextResponse.json(row);
}
