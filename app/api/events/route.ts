import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const muxId = searchParams.get('mux_id');
  const severity = searchParams.get('severity');

  let sql = `
    SELECT e.*, m.name as mux_name, c.name as channel_name, s.name as sfn_node_name
    FROM events e
    LEFT JOIN multiplexes m ON m.id=e.mux_id
    LEFT JOIN channels c ON c.id=e.channel_id
    LEFT JOIN sfn_nodes s ON s.id=e.sfn_node_id
    WHERE 1=1
  `;
  const args: (string | number)[] = [];
  if (muxId) { sql += ' AND e.mux_id=?'; args.push(muxId); }
  if (severity) { sql += ' AND e.severity=?'; args.push(severity); }
  sql += ' ORDER BY e.created_at DESC LIMIT ?';
  args.push(limit);

  const rows = db.prepare(sql).all(...args);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const stmt = db.prepare(`
    INSERT INTO events (severity,source,mux_id,channel_id,sfn_node_id,message,details)
    VALUES (@severity,@source,@mux_id,@channel_id,@sfn_node_id,@message,@details)
  `);
  const info = stmt.run(body);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
