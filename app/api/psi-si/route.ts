import { dbAll, dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');

  const query = muxId
    ? `SELECT * FROM psi_si_tables WHERE mux_id=? ORDER BY table_type`
    : `SELECT p.*, m.name as mux_name FROM psi_si_tables p JOIN multiplexes m ON m.id=p.mux_id ORDER BY m.number, p.table_type`;
  const rows = muxId ? await dbAll(query, [muxId]) : await dbAll(query);
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const body = await req.json(); // { id, cycle_ms, enabled, version }
  await dbRun(`UPDATE psi_si_tables SET cycle_ms=@cycle_ms, enabled=@enabled, version=@version, updated_at=CURRENT_TIMESTAMP WHERE id=@id`, body);
  const row = await dbGet('SELECT * FROM psi_si_tables WHERE id=?', [body.id]);
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const muxId = searchParams.get('mux_id');
  const id = searchParams.get('id');
  if (muxId) {
    await dbRun('DELETE FROM psi_si_tables WHERE mux_id=?', [muxId]);
    return NextResponse.json({ ok: true });
  }
  if (id) {
    await dbRun('DELETE FROM psi_si_tables WHERE id=?', [id]);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Podaj mux_id lub id' }, { status: 400 });
}

// ─── POST /api/psi-si  { mux_id, overwrite? } ────────────────────────────────
// Generates a standard set of PSI/SI tables for the given MUX based on its type.
type MuxRow = {
  id: number; name: string; mux_type: string; sfn_enabled: number;
  network_id: number | null; ts_id: number | null; onid: number | null;
  standard: string;
};
type ChannelRow = { id: number; name: string; number: number; };

const TABLE_ORDER = ['PAT','PMT','NIT','SDT','EIT','TDT','TOT','MIP','BAT','AIT'];

function tablesForType(mux: MuxRow, channels: ChannelRow[]): {
  table_type: string; pid: number; cycle_ms: number; enabled: number; payload_json: string;
}[] {
  const t = mux.mux_type; // 'terrestrial' | 'satellite' | 'cable' | 'iptv'
  const svcNames = channels.map(c => c.name);
  const programCount = channels.length;

  const networkName =
    t === 'terrestrial' ? 'Naziemna TV Cyfrowa' :
    t === 'satellite'   ? 'Platforma Satelitarna' :
    t === 'cable'       ? 'Sieć Kablowa' :
    'IPTV / SMATV';

  const rows: { table_type: string; pid: number; cycle_ms: number; enabled: number; payload_json: string }[] = [];

  // PAT – always
  rows.push({ table_type: 'PAT', pid: 0, cycle_ms: 100, enabled: 1,
    payload_json: JSON.stringify({ program_count: programCount, ts_id: mux.ts_id ?? 1 }) });

  // PMT – one per channel (PID 0x0100 + channel index)
  channels.forEach((ch, i) => {
    rows.push({ table_type: 'PMT', pid: 0x0100 + i, cycle_ms: 100, enabled: 1,
      payload_json: JSON.stringify({ service: ch.name, service_id: ch.number || (i + 1), video_pid: 0x0200 + i * 0x10, audio_pid: 0x0201 + i * 0x10 }) });
  });

  // NIT – terrestrial, satellite, cable (not IPTV)
  if (t !== 'iptv') {
    rows.push({ table_type: 'NIT', pid: 16, cycle_ms: 500, enabled: 1,
      payload_json: JSON.stringify({ network_name: networkName, network_id: mux.network_id ?? 1, mux_name: mux.name }) });
  }

  // SDT – always
  rows.push({ table_type: 'SDT', pid: 17, cycle_ms: 500, enabled: 1,
    payload_json: JSON.stringify({ services: svcNames, ts_id: mux.ts_id ?? 1, onid: mux.onid ?? 1 }) });

  // BAT – terrestrial and satellite (bouquet associations)
  if (t === 'terrestrial' || t === 'satellite') {
    rows.push({ table_type: 'BAT', pid: 17, cycle_ms: 10000, enabled: 1,
      payload_json: JSON.stringify({ bouquet_name: networkName, bouquet_id: 1 }) });
  }

  // EIT – always (EPG)
  rows.push({ table_type: 'EIT', pid: 18, cycle_ms: 2000, enabled: 1,
    payload_json: JSON.stringify({ epg_days: t === 'iptv' ? 3 : 7, services: programCount }) });

  // TDT – always
  rows.push({ table_type: 'TDT', pid: 20, cycle_ms: 30000, enabled: 1,
    payload_json: JSON.stringify({ utc_sync: true }) });

  // TOT – all except IPTV
  if (t !== 'iptv') {
    rows.push({ table_type: 'TOT', pid: 20, cycle_ms: 30000, enabled: 1,
      payload_json: JSON.stringify({ timezone: 'Europe/Warsaw', offset_min: 60, dst: true }) });
  }

  // MIP – only terrestrial SFN (GPS mega-frame sync)
  if (t === 'terrestrial') {
    rows.push({ table_type: 'MIP', pid: 348, cycle_ms: 200, enabled: mux.sfn_enabled ?? 0,
      payload_json: JSON.stringify({ mega_frame_count: 4, gps_ref: true, sfn_id: mux.ts_id ?? 1 }) });
  }

  // Sort by canonical order
  rows.sort((a, b) => {
    const ai = TABLE_ORDER.indexOf(a.table_type);
    const bi = TABLE_ORDER.indexOf(b.table_type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return rows;
}

export async function POST(req: Request) {
  try {
    const { mux_id, overwrite } = await req.json() as { mux_id: number; overwrite?: boolean };
    if (!mux_id) return NextResponse.json({ ok: false, error: 'Brak mux_id' }, { status: 400 });

    const mux = await dbGet<MuxRow>('SELECT * FROM multiplexes WHERE id=?', [mux_id]);
    if (!mux) return NextResponse.json({ ok: false, error: 'MUX nie istnieje' }, { status: 404 });

    const existing = await dbAll<{ id: number }>('SELECT id FROM psi_si_tables WHERE mux_id=?', [mux_id]);
    if (existing.length > 0 && !overwrite) {
      return NextResponse.json({ ok: false, exists: true, count: existing.length }, { status: 409 });
    }
    if (overwrite) {
      await dbRun('DELETE FROM psi_si_tables WHERE mux_id=?', [mux_id]);
    }

    const channels = await dbAll<ChannelRow>(
      'SELECT id, name, number FROM channels WHERE mux_id=? ORDER BY number', [mux_id]
    );

    const tables = tablesForType(mux, channels);
    for (const t of tables) {
      await dbRun(
        `INSERT INTO psi_si_tables (mux_id, table_type, pid, version, cycle_ms, enabled, payload_json)
         VALUES (@mux_id, @table_type, @pid, @version, @cycle_ms, @enabled, @payload_json)`,
        { mux_id, version: 1, ...t }
      );
    }

    return NextResponse.json({ ok: true, generated: tables.length });
  } catch (err) {
    console.error('[psi-si] POST error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
