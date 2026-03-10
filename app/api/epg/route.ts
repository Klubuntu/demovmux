import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channel_id');
    const date = searchParams.get('date'); // YYYY-MM-DD

    let sql = `
      SELECT ep.*,
             c.name AS channel_name,
             c.short_name,
             c.stream_type
      FROM epg_programs ep
      JOIN channels c ON c.id = ep.channel_id
    `;
    const params: (string | number)[] = [];
    const where: string[] = [];

    if (channelId) {
      where.push('ep.channel_id = ?');
      params.push(Number(channelId));
    }
    if (date) {
      where.push("DATE(ep.start_at) = ?");
      params.push(date);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY ep.channel_id, ep.start_at ASC';

    const rows = db.prepare(sql).all(...params);
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { channel_id, title, description, start_at, end_at, category, language, episode_num, series_id, rating, poster_url } = body;

    if (!channel_id || !title || !start_at || !end_at) {
      return NextResponse.json({ error: 'channel_id, title, start_at, end_at are required' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO epg_programs (channel_id,title,description,start_at,end_at,category,language,episode_num,series_id,rating,poster_url)
      VALUES (@channel_id,@title,@description,@start_at,@end_at,@category,@language,@episode_num,@series_id,@rating,@poster_url)
    `).run({ channel_id, title, description: description ?? null, start_at, end_at, category: category ?? null, language: language ?? 'pl', episode_num: episode_num ?? null, series_id: series_id ?? null, rating: rating ?? null, poster_url: poster_url ?? null });

    const row = db.prepare('SELECT * FROM epg_programs WHERE id=?').get(result.lastInsertRowid);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
