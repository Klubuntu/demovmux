import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const mux = db.prepare('SELECT * FROM multiplexes WHERE id = ?').get(id);
  if (!mux) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const channels = db.prepare('SELECT * FROM channels WHERE mux_id = ? ORDER BY lcn').all(id);
  const sfn = db.prepare('SELECT * FROM sfn_nodes WHERE mux_id = ? ORDER BY name').all(id);
  const psi = db.prepare('SELECT * FROM psi_si_tables WHERE mux_id = ? ORDER BY table_type').all(id);
  return NextResponse.json({ ...mux as object, channels, sfn_nodes: sfn, psi_si: psi });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  db.prepare(`
    UPDATE multiplexes SET name=@name, standard=@standard, mux_type=@mux_type, radio_enabled=@radio_enabled, video_codec=@video_codec,
    modulation=@modulation, fft_mode=@fft_mode, guard_interval=@guard_interval, fec=@fec,
    bandwidth_mhz=@bandwidth_mhz, frequency_band=@frequency_band, frequency_mhz=@frequency_mhz,
    channel_number=@channel_number, polarization=@polarization, network_id=@network_id,
    ts_id=@ts_id, onid=@onid, total_bitrate_mbps=@total_bitrate_mbps, sfn_enabled=@sfn_enabled,
    status=@status, notes=@notes, updated_at=datetime('now')
    WHERE id=@id
  `).run({ mux_type: 'terrestrial', radio_enabled: 0, ...body, id });
  const row = db.prepare('SELECT * FROM multiplexes WHERE id = ?').get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM multiplexes WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
