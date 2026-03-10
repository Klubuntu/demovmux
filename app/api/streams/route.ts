import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM input_streams ORDER BY name').all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const stmt = db.prepare(`
    INSERT INTO input_streams (name,broadcaster,type,protocol,source_address,source_port,bitrate_mbps,redundancy_mode,redundancy_partner_id,encryption,status)
    VALUES (@name,@broadcaster,@type,@protocol,@source_address,@source_port,@bitrate_mbps,@redundancy_mode,@redundancy_partner_id,@encryption,@status)
  `);
  const info = stmt.run(body);
  const row = db.prepare('SELECT * FROM input_streams WHERE id = ?').get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
