import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT c.*, m.name as mux_name FROM channels c JOIN multiplexes m ON m.id=c.mux_id WHERE c.id=?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  db.prepare(`
    UPDATE channels SET mux_id=@mux_id, name=@name, short_name=@short_name, lcn=@lcn,
    service_id=@service_id, pmt_pid=@pmt_pid, video_pid=@video_pid, audio_pid=@audio_pid,
    pcr_pid=@pcr_pid, video_format=@video_format, video_bitrate_mbps=@video_bitrate_mbps,
    audio_bitrate_kbps=@audio_bitrate_kbps, statmux_weight=@statmux_weight,
    statmux_min_mbps=@statmux_min_mbps, statmux_max_mbps=@statmux_max_mbps,
    hbbtv_enabled=@hbbtv_enabled, hbbtv_url=@hbbtv_url, teletext_enabled=@teletext_enabled,
    ssu_enabled=@ssu_enabled, input_stream_id=@input_stream_id, status=@status,
    stream_url=@stream_url, stream_type=@stream_type,
    epg_source_url=@epg_source_url, epg_channel_id=@epg_channel_id,
    channel_type=@channel_type, audio_codec=@audio_codec,
    sample_rate_hz=@sample_rate_hz, stereo_mode=@stereo_mode,
    updated_at=datetime('now')
    WHERE id=@id
  `).run({
    stream_url: null, stream_type: 'hls', epg_source_url: null, epg_channel_id: null,
    channel_type: 'tv', audio_codec: 'AAC', sample_rate_hz: 48000, stereo_mode: 'stereo',
    ...body, id,
  });
  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
