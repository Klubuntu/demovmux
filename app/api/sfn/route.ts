import { dbAll, dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');
  const query = muxId
    ? 'SELECT s.*, m.name as mux_name FROM sfn_nodes s JOIN multiplexes m ON m.id=s.mux_id WHERE s.mux_id=? ORDER BY s.name'
    : 'SELECT s.*, m.name as mux_name FROM sfn_nodes s JOIN multiplexes m ON m.id=s.mux_id ORDER BY m.number, s.name';
  const rows = muxId ? await dbAll(query, [muxId]) : await dbAll(query);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const info = await dbRun(`
    INSERT INTO sfn_nodes (mux_id,name,location,latitude,longitude,power_w,antenna_height_m,frequency_mhz,mip_enabled,gps_sync,delay_us,status)
    VALUES (@mux_id,@name,@location,@latitude,@longitude,@power_w,@antenna_height_m,@frequency_mhz,@mip_enabled,@gps_sync,@delay_us,@status)
  `, body);
  const row = await dbGet('SELECT * FROM sfn_nodes WHERE id = ?', [info.lastInsertRowid]);
  return NextResponse.json(row, { status: 201 });
}
