import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getDb();
  const muxes = db.prepare(`
    SELECT m.*,
      COUNT(DISTINCT c.id) as channel_count,
      COUNT(DISTINCT s.id) as sfn_count
    FROM multiplexes m
    LEFT JOIN channels c ON c.mux_id = m.id
    LEFT JOIN sfn_nodes s ON s.mux_id = m.id
    GROUP BY m.id
    ORDER BY m.number
  `).all();
  return NextResponse.json(muxes);
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const stmt = db.prepare(`
    INSERT INTO multiplexes (name,number,standard,mux_type,radio_enabled,video_codec,modulation,fft_mode,guard_interval,fec,bandwidth_mhz,frequency_band,frequency_mhz,channel_number,polarization,network_id,ts_id,onid,total_bitrate_mbps,sfn_enabled,status,notes)
    VALUES (@name,@number,@standard,@mux_type,@radio_enabled,@video_codec,@modulation,@fft_mode,@guard_interval,@fec,@bandwidth_mhz,@frequency_band,@frequency_mhz,@channel_number,@polarization,@network_id,@ts_id,@onid,@total_bitrate_mbps,@sfn_enabled,@status,@notes)
  `);
  const info = stmt.run({ mux_type: 'terrestrial', radio_enabled: 0, ...body });
  const row = db.prepare('SELECT * FROM multiplexes WHERE id = ?').get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
