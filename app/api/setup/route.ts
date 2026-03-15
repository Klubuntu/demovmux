import { isDbEmpty, restoreDemoData } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/setup → { empty: boolean }
export async function GET() {
  try {
    const empty = await isDbEmpty();
    return NextResponse.json({ empty });
  } catch (err) {
    console.error('[setup] GET error', err);
    return NextResponse.json({ empty: false, error: String(err) }, { status: 500 });
  }
}

// POST /api/setup → seeds demo data
export async function POST() {
  try {
    const empty = await isDbEmpty();
    if (!empty) {
      return NextResponse.json({ ok: false, message: 'Baza danych nie jest pusta – dane przykładowe już istnieją.' }, { status: 409 });
    }
    await restoreDemoData();
    return NextResponse.json({ ok: true, message: 'Dane przykładowe zostały wstawione pomyślnie.' });
  } catch (err) {
    console.error('[setup] POST error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
