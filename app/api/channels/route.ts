import { dbAll, dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');
  const query = muxId
    ? 'SELECT c.*, m.name as mux_name, m.mux_type FROM channels c JOIN multiplexes m ON m.id=c.mux_id WHERE c.mux_id=? ORDER BY c.lcn'
    : 'SELECT c.*, m.name as mux_name, m.mux_type FROM channels c JOIN multiplexes m ON m.id=c.mux_id ORDER BY c.mux_id, c.lcn';
  const rows = muxId ? await dbAll(query, [muxId]) : await dbAll(query);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const info = await dbRun(`
    INSERT INTO channels (mux_id,name,short_name,lcn,service_id,pmt_pid,video_pid,audio_pid,pcr_pid,
    video_format,video_bitrate_mbps,audio_bitrate_kbps,statmux_weight,statmux_min_mbps,statmux_max_mbps,
    hbbtv_enabled,hbbtv_url,teletext_enabled,ssu_enabled,input_stream_id,status,
    stream_url,stream_type,epg_source_url,epg_channel_id,
    channel_type,audio_codec,sample_rate_hz,stereo_mode)
    VALUES (@mux_id,@name,@short_name,@lcn,@service_id,@pmt_pid,@video_pid,@audio_pid,@pcr_pid,
    @video_format,@video_bitrate_mbps,@audio_bitrate_kbps,@statmux_weight,@statmux_min_mbps,@statmux_max_mbps,
    @hbbtv_enabled,@hbbtv_url,@teletext_enabled,@ssu_enabled,@input_stream_id,@status,
    @stream_url,@stream_type,@epg_source_url,@epg_channel_id,
    @channel_type,@audio_codec,@sample_rate_hz,@stereo_mode)
  `, {
    stream_url: null, stream_type: 'hls', epg_source_url: null, epg_channel_id: null,
    channel_type: 'tv', audio_codec: 'AAC', sample_rate_hz: 48000, stereo_mode: 'stereo',
    input_stream_id: 1,
    ...body,
  });
  const row = await dbGet('SELECT c.*, m.name as mux_name, m.mux_type FROM channels c JOIN multiplexes m ON m.id=c.mux_id WHERE c.id = ?', [info.lastInsertRowid]);
  return NextResponse.json(row, { status: 201 });
}
