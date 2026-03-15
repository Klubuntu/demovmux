import { createDb, dbRun, seedDemoData } from '@/lib/db';
import { NextResponse } from 'next/server';

const RESET_PASSWORD = process.env.FACTORY_RESET_PASSWORD ?? 'dmv$2026';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (password !== RESET_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Nieprawidłowe hasło.' }, { status: 403 });
    }

    const client = createDb();
    // Zawsze resetuj do fabrycznych danych zapisanych w kodzie (seedData/seedDataAsync),
    // a nie ze snapshotu pliku bazy.
    if (client.kind === 'postgres') {
      await dbRun(`
        TRUNCATE TABLE
          epg_programs,
          statmux_snapshots,
          events,
          psi_si_tables,
          sfn_nodes,
          channels,
          input_streams,
          multiplexes,
          service_status
        RESTART IDENTITY CASCADE
      `);
    } else {
      const tables = [
        'epg_programs',
        'statmux_snapshots',
        'events',
        'psi_si_tables',
        'sfn_nodes',
        'channels',
        'input_streams',
        'multiplexes',
        'service_status',
      ];
      for (const table of tables) {
        await dbRun(`DELETE FROM ${table}`);
      }
      // reset autoincrement counters in SQLite
      await dbRun(`DELETE FROM sqlite_sequence`);
    }

    // Re-seed with demo data
    await seedDemoData();

    return NextResponse.json({ ok: true, source: 'code-defaults' });
  } catch (err) {
    console.error('[factory-reset] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
