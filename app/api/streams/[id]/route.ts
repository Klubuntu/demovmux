import { dbGet, dbRun } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet('SELECT * FROM input_streams WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  await dbRun(`
    UPDATE input_streams SET name=@name, broadcaster=@broadcaster, type=@type, protocol=@protocol,
    source_address=@source_address, source_port=@source_port, bitrate_mbps=@bitrate_mbps,
    redundancy_mode=@redundancy_mode, encryption=@encryption, mode=@mode,
    emulator_profile_id=@emulator_profile_id, status=@status,
    updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `, { ...body, id });
  const row = await dbGet('SELECT * FROM input_streams WHERE id = ?', [id]);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbRun('DELETE FROM input_streams WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
