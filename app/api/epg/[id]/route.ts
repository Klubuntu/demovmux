import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await dbGet('SELECT * FROM epg_programs WHERE id=?', [Number(id)]);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, start_at, end_at, category, language, episode_num, series_id, rating, poster_url } = body;

    await dbRun(`
      UPDATE epg_programs
      SET title=@title, description=@description, start_at=@start_at, end_at=@end_at,
          category=@category, language=@language, episode_num=@episode_num,
          series_id=@series_id, rating=@rating, poster_url=@poster_url,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `, { id: Number(id), title, description: description ?? null, start_at, end_at, category: category ?? null, language: language ?? 'pl', episode_num: episode_num ?? null, series_id: series_id ?? null, rating: rating ?? null, poster_url: poster_url ?? null });

    const row = await dbGet('SELECT * FROM epg_programs WHERE id=?', [Number(id)]);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await dbRun('DELETE FROM epg_programs WHERE id=?', [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
