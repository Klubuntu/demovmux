'use client';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Wand2, Trash2, AlertTriangle } from 'lucide-react';

interface PSITable {
  id: number; mux_id: number; mux_name?: string; table_type: string; pid: number;
  version: number; cycle_ms: number; enabled: number; payload_json: string; updated_at: string;
}
interface Mux { id: number; name: string; number: number; mux_type: string; }

const tableDesc: Record<string, string> = {
  PAT: 'Program Association Table – mapuje PID → Program',
  PMT: 'Program Map Table – opisuje strumienie jednego programu',
  NIT: 'Network Information Table – dane o sieci i transponderach',
  SDT: 'Service Description Table – nazwy i właściwości serwisów',
  EIT: 'Event Information Table – EPG (Program Guide)',
  TDT: 'Time Date Table – aktualny czas UTC',
  TOT: 'Time Offset Table – czas z uwzględnieniem strefy',
  AIT: 'Application Information Table – HbbTV apps',
  MIP: 'Mega-frame Initialization Packet – sync SFN/GPS (tylko DVB-T2 SFN)',
  BAT: 'Bouquet Association Table – grupy serwisów',
};

const tableColor: Record<string, string> = {
  PAT: 'bg-blue-100 text-blue-700', PMT: 'bg-blue-50 text-blue-600',
  NIT: 'bg-purple-100 text-purple-700', SDT: 'bg-green-100 text-green-700',
  EIT: 'bg-orange-100 text-orange-700', TDT: 'bg-gray-100 text-gray-600',
  TOT: 'bg-gray-100 text-gray-600', AIT: 'bg-pink-100 text-pink-700',
  MIP: 'bg-yellow-100 text-yellow-700', BAT: 'bg-teal-100 text-teal-700',
};

const muxTypeBadge: Record<string, string> = {
  terrestrial: 'DVB-T2', satellite: 'DVB-S2', cable: 'DVB-C', iptv: 'IPTV',
};

export default function TablicePage() {
  const [tables, setTables] = useState<PSITable[]>([]);
  const [muxes, setMuxes] = useState<Mux[]>([]);
  const [filterMux, setFilterMux] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<Mux | null>(null);
  const [genMsg, setGenMsg] = useState<{ muxId: number; text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    const q = filterMux ? `?mux_id=${filterMux}` : '';
    fetch(`/api/psi-si${q}`).then(r => r.json()).then(setTables);
  }, [filterMux]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch('/api/multiplexes').then(r => r.json()).then(setMuxes); }, []);

  const toggle = async (t: PSITable) => {
    setSaving(t.id);
    await fetch('/api/psi-si', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, enabled: t.enabled ? 0 : 1, cycle_ms: t.cycle_ms, version: t.version }),
    });
    load();
    setSaving(null);
  };

  const updateCycle = async (t: PSITable, cycle_ms: number) => {
    await fetch('/api/psi-si', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, enabled: t.enabled, cycle_ms, version: t.version }),
    });
    load();
  };

  const deleteMuxTables = async (muxId: number) => {
    await fetch(`/api/psi-si?mux_id=${muxId}`, { method: 'DELETE' });
    load();
  };

  const generate = async (mux: Mux, overwrite = false) => {
    setGenerating(mux.id);
    setGenMsg(null);
    setConfirmOverwrite(null);
    const res = await fetch('/api/psi-si', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mux_id: mux.id, overwrite }),
    });
    const data = await res.json();
    setGenerating(null);
    if (res.status === 409 && data.exists) {
      setConfirmOverwrite(mux);
      return;
    }
    setGenMsg({
      muxId: mux.id,
      ok: data.ok,
      text: data.ok
        ? `✓ Wygenerowano ${data.generated} tablic PSI/SI`
        : (data.error ?? 'Błąd generowania'),
    });
    if (data.ok) load();
  };

  // Muxes that have no PSI-SI tables yet
  const muxIdsWithTables = new Set(tables.map(t => t.mux_id));
  const muxesWithout = muxes.filter(m => !muxIdsWithTables.has(m.id));

  const groupedByMux = tables.reduce<Record<string, { mux: Mux | undefined; rows: PSITable[] }>>((acc, t) => {
    const key = t.mux_name ?? `MUX ${t.mux_id}`;
    if (!acc[key]) acc[key] = { mux: muxes.find(m => m.id === t.mux_id), rows: [] };
    acc[key].rows.push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tablice PSI/SI</h2>
          <p className="text-sm text-gray-500">Program Specific Information / Service Information – konfiguracja strumienia TS</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterMux} onChange={e => setFilterMux(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Wszystkie MUX</option>
            {muxes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* MUXes without any PSI-SI tables */}
      {muxesWithout.length > 0 && !filterMux && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle size={16} />
            <span className="text-sm font-semibold">Multipleksy bez tablic PSI/SI ({muxesWithout.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {muxesWithout.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{m.name}</span>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  {muxTypeBadge[m.mux_type] ?? m.mux_type}
                </span>
                <button
                  onClick={() => generate(m)}
                  disabled={generating === m.id}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Wand2 size={11} className={generating === m.id ? 'animate-pulse' : ''} />
                  {generating === m.id ? 'Generuję…' : 'Generuj tablice'}
                </button>
                {genMsg?.muxId === m.id && (
                  <span className={`text-xs ${genMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{genMsg.text}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm overwrite dialog */}
      {confirmOverwrite && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle size={16} />
            <span className="text-sm">
              <strong>{confirmOverwrite.name}</strong> ma już tablice PSI/SI. Czy chcesz je nadpisać nowymi?
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => generate(confirmOverwrite, true)}
              className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700"
            >
              Nadpisz
            </button>
            <button
              onClick={() => setConfirmOverwrite(null)}
              className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {Object.entries(groupedByMux).map(([muxName, { mux, rows }]) => (
        <div key={muxName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{muxName}</span>
              {mux && (
                <span className="text-[10px] font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                  {muxTypeBadge[mux.mux_type] ?? mux.mux_type}
                </span>
              )}
              <span className="text-xs text-gray-400">{rows.length} tablic</span>
              {genMsg?.muxId === mux?.id && genMsg && (
                <span className={`text-xs ${genMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{genMsg.text}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {mux && (
                <button
                  onClick={() => generate(mux)}
                  disabled={generating === mux.id}
                  title="Regeneruj tablice"
                  className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  <Wand2 size={11} className={generating === mux.id ? 'animate-pulse' : ''} />
                  {generating === mux.id ? 'Generuję…' : 'Regeneruj'}
                </button>
              )}
              {mux && (
                <button
                  onClick={() => deleteMuxTables(mux.id)}
                  title="Usuń wszystkie tablice tego MUX"
                  className="flex items-center gap-1.5 text-xs text-red-500 border border-red-100 px-2.5 py-1 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={11} />
                  Usuń
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2.5 text-left">Tablica</th>
                <th className="px-4 py-2.5 text-left">Opis</th>
                <th className="px-4 py-2.5 text-left">PID (hex)</th>
                <th className="px-4 py-2.5 text-left">Wersja</th>
                <th className="px-4 py-2.5 text-left">Cykl (ms)</th>
                <th className="px-4 py-2.5 text-left">Payload</th>
                <th className="px-4 py-2.5 text-left">Aktywna</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(t => (
                <tr key={t.id} className={`hover:bg-gray-50 ${!t.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${tableColor[t.table_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.table_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{tableDesc[t.table_type] ?? '–'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    0x{t.pid?.toString(16).toUpperCase().padStart(4, '0')}
                    <span className="text-gray-400 ml-1">({t.pid})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">v{t.version}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      defaultValue={t.cycle_ms}
                      onBlur={e => updateCycle(t, Number(e.target.value))}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                    {t.payload_json ? (
                      <code className="bg-gray-50 px-2 py-0.5 rounded text-[10px] text-gray-600 block truncate max-w-[180px]">
                        {t.payload_json}
                      </code>
                    ) : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(t)}
                      disabled={saving === t.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${t.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}
      {tables.length === 0 && muxesWithout.length === 0 && (
        <div className="text-center py-16 text-gray-400">Brak danych PSI/SI</div>
      )}
    </div>
  );
}
