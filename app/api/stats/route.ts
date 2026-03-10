import { dbAll, dbGet } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');

  // Summary stats
  const muxCount = ((await dbGet('SELECT COUNT(*) as c FROM multiplexes')) as { c: number }).c;
  const activeMux = ((await dbGet("SELECT COUNT(*) as c FROM multiplexes WHERE status='active'")) as { c: number }).c;
  const channelCount = ((await dbGet('SELECT COUNT(*) as c FROM channels')) as { c: number }).c;
  const sfnCount = ((await dbGet('SELECT COUNT(*) as c FROM sfn_nodes')) as { c: number }).c;
  const activeStreams = ((await dbGet("SELECT COUNT(*) as c FROM input_streams WHERE status='active'")) as { c: number }).c;
  const pendingAlarms = ((await dbGet("SELECT COUNT(*) as c FROM events WHERE resolved=0 AND severity IN ('error','critical','warning')")) as { c: number }).c;

  // Per-MUX bitrate usage
  const muxBitrates = await dbAll(`
    SELECT m.id, m.name, m.number, m.total_bitrate_mbps as capacity,
      COALESCE(SUM(c.video_bitrate_mbps), 0) + COALESCE(COUNT(c.id)*0.5, 0) as used_video
    FROM multiplexes m
    LEFT JOIN channels c ON c.mux_id=m.id AND c.status='active'
    GROUP BY m.id ORDER BY m.number
  `);

  // Last 24h snapshots for chart
  const chartQuery = muxId
    ? `SELECT snapshot_at, total_bitrate_mbps FROM statmux_snapshots WHERE mux_id=? ORDER BY snapshot_at DESC LIMIT 48`
    : `SELECT snapshot_at, AVG(total_bitrate_mbps) as total_bitrate_mbps FROM statmux_snapshots GROUP BY snapshot_at ORDER BY snapshot_at DESC LIMIT 48`;
  const chartData = muxId ? await dbAll(chartQuery, [muxId]) : await dbAll(chartQuery);

  return NextResponse.json({
    summary: { muxCount, activeMux, channelCount, sfnCount, activeStreams, pendingAlarms },
    muxBitrates,
    chartData: chartData.reverse(),
  });
}
