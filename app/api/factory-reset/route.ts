import { createDb, dbRun, hasLocalDemoSnapshot, restoreDemoData, seedDemoData } from '@/lib/db';
import { NextResponse } from 'next/server';

const RESET_PASSWORD = process.env.FACTORY_RESET_PASSWORD ?? 'dmv$2026';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (password !== RESET_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Nieprawidłowe hasło.' }, { status: 403 });
    }

    const client = createDb();
    if (client.kind === 'sqlite' && hasLocalDemoSnapshot()) {
      await restoreDemoData();
      return NextResponse.json({ ok: true, restoredFromSnapshot: true });
    }

    // Wipe all data tables in dependency order
    const tables = [
      'epg_programs',
      'statmux_snapshots',
      'events',
      'psi_si_tables',
      'sfn_nodes',
      'channels',
      'input_streams',
      'multiplexes',
    ];
    for (const table of tables) {
      await dbRun(`DELETE FROM ${table}`);
    }

    // Reset service status to default
    await dbRun(`UPDATE service_status SET status = 'active', message = NULL`);

    // Re-seed with demo data
    await seedDemoData();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[factory-reset] error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
