import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

interface RuntimeProfile {
  id: string;
  label: string;
  type: string;
  protocol: string;
  mode?: string;
  sourceAddress: string;
  sourcePort: number;
  ingestAddress?: string | null;
  ingestPort?: number | null;
  statusPort: number;
  encryption?: string;
  srtPassphrase?: string;
  srtListenUrl?: string;
  sourceHint?: string;
}

async function fetchStatus(port: number) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cfgPath = path.join(process.cwd(), 'tools', 'input-emulators', 'public', 'runtime-config.json');
    const raw = await fs.readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw) as { generatedAt: string; dashboardUrl: string; profiles: RuntimeProfile[] };

    const profiles = await Promise.all(
      (cfg.profiles ?? []).map(async (p) => {
        const status = await fetchStatus(p.statusPort);
        return {
          ...p,
          online: Boolean(status),
          status,
        };
      }),
    );

    return NextResponse.json({
      running: true,
      generatedAt: cfg.generatedAt,
      dashboardUrl: cfg.dashboardUrl,
      profiles,
    });
  } catch {
    return NextResponse.json({
      running: false,
      profiles: [],
      message: 'Input emulators are not running or runtime-config.json is missing',
    });
  }
}
