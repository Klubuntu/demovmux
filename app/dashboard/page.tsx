'use client';
import { useEffect, useState } from 'react';
import { Radio, Tv2, Signal, GitBranch, Bell, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import StatCard from '@/components/StatCard';
import BitrateBar from '@/components/BitrateBar';
import StatusBadge from '@/components/StatusBadge';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Summary { muxCount: number; activeMux: number; channelCount: number; sfnCount: number; activeStreams: number; pendingAlarms: number; }
interface MuxBitrate { id: number; name: string; number: number; capacity: number; used_video: number; }
interface ChartPoint { snapshot_at: string; total_bitrate_mbps: number; }
interface StatsData { summary: Summary; muxBitrates: MuxBitrate[]; chartData: ChartPoint[]; }
interface Event { id: number; severity: string; source: string; message: string; created_at: string; resolved: number; mux_name?: string; }

const severityIcon = { info: Info, warning: AlertTriangle, error: XCircle, critical: XCircle };
const severityColor: Record<string, string> = { info: 'text-blue-500', warning: 'text-yellow-500', error: 'text-red-500', critical: 'text-red-700' };

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats);
    fetch('/api/events?limit=8').then(r => r.json()).then(setEvents);
  }, []);

  if (!stats) return <div className="flex items-center justify-center h-64 text-gray-400">Ładowanie…</div>;

  const { summary, muxBitrates, chartData } = stats;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Przegląd systemu wirtualnych multipleksów</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Multipleksy" value={summary.muxCount} sub={`${summary.activeMux} aktywnych`} icon={Radio} color="blue" />
        <StatCard title="Kanały" value={summary.channelCount} sub="w emisji" icon={Tv2} color="green" />
        <StatCard title="Strumienie" value={summary.activeStreams} sub="aktywnych" icon={Signal} color="purple" />
        <StatCard title="Węzły SFN" value={summary.sfnCount} sub="nadajników" icon={GitBranch} color="orange" />
        <StatCard title="Alarmy" value={summary.pendingAlarms} sub="nierozwiązane" icon={Bell} color={summary.pendingAlarms > 0 ? 'red' : 'green'} />
        <StatCard title="Status" value={summary.activeMux === summary.muxCount ? 'OK' : 'Uwaga'} sub="systemu" icon={CheckCircle2} color={summary.activeMux === summary.muxCount ? 'green' : 'orange'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bitrate chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Łączna przepływność TS (ostatnie 24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="snapshot_at" tickFormatter={v => new Date(v).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" Mbps" />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} Mbps`, 'Bitrate']} labelFormatter={(v) => new Date(v as string).toLocaleString('pl')} />
              <Area type="monotone" dataKey="total_bitrate_mbps" stroke="#3b82f6" fill="url(#grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* MUX bitrate bars */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Wykorzystanie pasma MUX</h3>
          <div className="space-y-4">
            {muxBitrates.map(m => (
              <BitrateBar key={m.id} used={m.used_video} total={m.capacity} label={m.name} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Ostatnie zdarzenia</h3>
          <a href="/zdarzenia" className="text-xs text-blue-600 hover:underline">Zobacz wszystkie →</a>
        </div>
        <div className="divide-y divide-gray-50">
          {events.map(ev => {
            const Icon = severityIcon[ev.severity as keyof typeof severityIcon] ?? Info;
            return (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                <Icon size={16} className={`mt-0.5 flex-shrink-0 ${severityColor[ev.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-900 font-medium">{ev.message}</span>
                    <StatusBadge value={ev.severity} type="severity" />
                    {ev.mux_name && <span className="text-xs text-gray-400">{ev.mux_name}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleString('pl')}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{ev.source}</span>
                  </div>
                </div>
                {ev.resolved === 1 && <span className="text-xs text-green-500 flex-shrink-0">✓ Rozwiązane</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
