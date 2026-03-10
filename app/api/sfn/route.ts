import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');
  const query = muxId
    ? 'SELECT s.*, m.name as mux_name FROM sfn_nodes s JOIN multiplexes m ON m.id=s.mux_id WHERE s.mux_id=? ORDER BY s.name'
    : 'SELECT s.*, m.name as mux_name FROM sfn_nodes s JOIN multiplexes m ON m.id=s.mux_id ORDER BY m.number, s.name';
  const rows = muxId ? db.prepare(query).all(muxId) : db.prepare(query).all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const stmt = db.prepare(`
    INSERT INTO sfn_nodes (mux_id,name,location,latitude,longitude,power_w,antenna_height_m,frequency_mhz,mip_enabled,gps_sync,delay_us,status)
    VALUES (@mux_id,@name,@location,@latitude,@longitude,@power_w,@antenna_height_m,@frequency_mhz,@mip_enabled,@gps_sync,@delay_us,@status)
  `);
  const info = stmt.run(body);
  const row = db.prepare('SELECT * FROM sfn_nodes WHERE id = ?').get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
