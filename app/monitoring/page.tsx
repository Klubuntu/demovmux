'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { useCallback } from 'react';

interface ChartPoint { snapshot_at: string; total_bitrate_mbps: number; }
interface MuxBitrate { id: number; name: string; number: number; capacity: number; used_video: number; }

export default function MonitoringPage() {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [muxBitrates, setMuxBitrates] = useState<MuxBitrate[]>([]);
  const [selectedMux, setSelectedMux] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = selectedMux ? `?mux_id=${selectedMux}` : '';
    const data = await fetch(`/api/stats${q}`).then(r => r.json());
    setChartData(data.chartData);
    setMuxBitrates(data.muxBitrates);
    setLoading(false);
  }, [selectedMux]);

  useEffect(() => { load(); }, [load]);

  const barData = muxBitrates.map(m => ({
    name: m.name,
    używane: parseFloat(m.used_video.toFixed(1)),
    wolne: parseFloat((m.capacity - m.used_video).toFixed(1)),
    pojemność: m.capacity,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Monitoring</h2>
          <p className="text-sm text-gray-500">Wykresy przepływności i obciążenia multipleksów</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">MUX:</label>
          <select value={selectedMux} onChange={e => setSelectedMux(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Wszystkie (avg)</option>
            {muxBitrates.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={load} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Odśwież</button>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Przepływność TS w czasie (ostatnie 24h)</h3>
        <p className="text-xs text-gray-400 mb-4">Dane zbierane co 30 min z modułu StatMux</p>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Ładowanie…</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="snapshot_at" tickFormatter={v => new Date(v).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} unit=" Mbps" />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} Mbps`, 'Bitrate']} labelFormatter={(v) => new Date(v as string).toLocaleString('pl')} />
              <Area type="monotone" dataKey="total_bitrate_mbps" name="Bitrate TS" stroke="#3b82f6" fill="url(#grad2)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Obciążenie pasm MUX</h3>
        <p className="text-xs text-gray-400 mb-4">Porównanie używanego i wolnego pasma na każdy multipleks</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} unit=" Mb" />
            <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} Mbps`]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="używane" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="wolne" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {muxBitrates.map(m => {
          const pct = Math.round((m.used_video / m.capacity) * 100);
          const color = pct > 90 ? 'text-red-600' : pct > 75 ? 'text-orange-500' : 'text-green-600';
          return (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-400 font-medium">{m.name}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{pct}%</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{m.used_video.toFixed(1)} / {m.capacity} Mbps</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
