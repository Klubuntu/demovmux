import { dbGet } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [muxRow, chRow, sfnRow, stRow, evRow] = await Promise.all([
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM multiplexes'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM channels'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM sfn_nodes'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM input_streams'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM events'),
    ]);

    const dbType = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.startsWith('postgres')
        ? 'PostgreSQL'
        : 'SQLite'
      : 'SQLite (local dev)';

    return NextResponse.json({
      dbType,
      version: '1.0.0',
      counts: {
        multiplexes: Number(muxRow?.c ?? 0),
        channels: Number(chRow?.c ?? 0),
        sfnNodes: Number(sfnRow?.c ?? 0),
        streams: Number(stRow?.c ?? 0),
        events: Number(evRow?.c ?? 0),
      },
    });
  } catch {
    return NextResponse.json({
      dbType: 'unknown',
      version: '1.0.0',
      counts: { multiplexes: 0, channels: 0, sfnNodes: 0, streams: 0, events: 0 },
    });
  }
}
