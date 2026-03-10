import { dbAll, dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await dbAll('SELECT * FROM input_streams ORDER BY name');
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const info = await dbRun(`
    INSERT INTO input_streams (name,broadcaster,type,protocol,source_address,source_port,bitrate_mbps,redundancy_mode,redundancy_partner_id,encryption,status)
    VALUES (@name,@broadcaster,@type,@protocol,@source_address,@source_port,@bitrate_mbps,@redundancy_mode,@redundancy_partner_id,@encryption,@status)
  `, body);
  const row = await dbGet('SELECT * FROM input_streams WHERE id = ?', [info.lastInsertRowid]);
  return NextResponse.json(row, { status: 201 });
}
