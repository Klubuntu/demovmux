import { dbGet, dbAll } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, { status: 'ok' | 'error'; message?: string }> = {};
  
  try {
    // Test database connectivity
    await dbGet('SELECT 1 as test');
    results.database = { status: 'ok' };
  } catch (err) {
    results.database = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test channels endpoint
    await dbAll('SELECT COUNT(*) as count FROM channels');
    results.channels = { status: 'ok' };
  } catch (err) {
    results.channels = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test multiplexes endpoint
    await dbAll('SELECT COUNT(*) as count FROM multiplexes');
    results.multiplexes = { status: 'ok' };
  } catch (err) {
    results.multiplexes = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test events endpoint
    await dbAll('SELECT COUNT(*) as count FROM events');
    results.events = { status: 'ok' };
  } catch (err) {
    results.events = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test EPG endpoint
    await dbAll('SELECT COUNT(*) as count FROM epg_programs');
    results.epg = { status: 'ok' };
  } catch (err) {
    results.epg = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test PSI/SI endpoint
    await dbAll('SELECT COUNT(*) as count FROM psi_si_tables');
    results['psi-si'] = { status: 'ok' };
  } catch (err) {
    results['psi-si'] = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test SFN nodes endpoint
    await dbAll('SELECT COUNT(*) as count FROM sfn_nodes');
    results.sfn = { status: 'ok' };
  } catch (err) {
    results.sfn = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test input streams endpoint
    await dbAll('SELECT COUNT(*) as count FROM input_streams');
    results.streams = { status: 'ok' };
  } catch (err) {
    results.streams = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  try {
    // Test StatMux snapshots endpoint
    await dbAll('SELECT COUNT(*) as count FROM statmux_snapshots');
    results.statmux = { status: 'ok' };
  } catch (err) {
    results.statmux = { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }

  const allOk = Object.values(results).every(r => r.status === 'ok');
  
  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    endpoints: results,
  }, { status: allOk ? 200 : 503 });
}
