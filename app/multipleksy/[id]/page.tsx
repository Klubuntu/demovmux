'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Radio, Tv2, GitBranch, Table2 } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import BitrateBar from '@/components/BitrateBar';

interface Channel { id: number; name: string; short_name: string; lcn: number; service_id: number; video_format: string; video_bitrate_mbps: number; statmux_weight: number; hbbtv_enabled: number; teletext_enabled: number; status: string; }
interface SFNNode { id: number; name: string; location: string; power_w: number; delay_us: number; gps_sync: number; status: string; }
interface PSITable { id: number; table_type: string; pid: number; version: number; cycle_ms: number; enabled: number; }
interface MuxDetail {
  id: number; name: string; number: number; standard: string; video_codec: string; modulation: string;
  fft_mode: string; guard_interval: string; fec: string; bandwidth_mhz: number; frequency_band: string;
  frequency_mhz: number; channel_number: number; polarization: string; network_id: number; ts_id: number;
  onid: number; total_bitrate_mbps: number; sfn_enabled: number; status: string; notes: string;
  channels: Channel[]; sfn_nodes: SFNNode[]; psi_si: PSITable[];
}

export default function MuxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mux, setMux] = useState<MuxDetail | null>(null);
  const [tab, setTab] = useState<'kanaly' | 'sfn' | 'psi'>('kanaly');

  useEffect(() => {
    fetch(`/api/multiplexes/${id}`).then(r => r.json()).then(data => {
      if (data.error) router.push('/multipleksy');
      else setMux(data);
    });
  }, [id, router]);

  if (!mux) return <div className="flex items-center justify-center h-64 text-gray-400">Ładowanie…</div>;

  const usedBitrate = mux.channels.reduce((s, c) => s + (c.video_bitrate_mbps ?? 0), 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/multipleksy" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            {mux.number}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{mux.name}</h2>
              <StatusBadge value={mux.status} type="mux" />
            </div>
            <p className="text-sm text-gray-400">{mux.standard} · {mux.video_codec} · {mux.modulation} · {mux.frequency_mhz} MHz</p>
          </div>
        </div>
      </div>

      {/* Parameters grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Radio size={16} className="text-blue-600" /> Parametry emisyjne</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Standard', mux.standard], ['Kodek wideo', mux.video_codec], ['Modulacja', mux.modulation],
            ['FFT', mux.fft_mode], ['Odstęp ochronny', mux.guard_interval], ['FEC', mux.fec],
            ['Szerokość kanału', `${mux.bandwidth_mhz} MHz`], ['Pasmo', mux.frequency_band],
            ['Częstotliwość', `${mux.frequency_mhz} MHz`], ['Kanał RF', mux.channel_number],
            ['Polaryzacja', mux.polarization], ['SFN', mux.sfn_enabled ? 'Tak' : 'Nie'],
            ['Network ID', mux.network_id], ['TS ID', mux.ts_id], ['ONID', mux.onid],
            ['Max bitrate', `${mux.total_bitrate_mbps} Mbps`],
          ].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400">{k}</p>
              <p className="font-medium text-gray-800 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <BitrateBar used={usedBitrate} total={mux.total_bitrate_mbps} label="Wykorzystanie pasma" />
        </div>
        {mux.notes && <p className="text-xs text-gray-400 mt-3 italic">{mux.notes}</p>}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-100">
          {([['kanaly', 'Kanały', Tv2], ['sfn', 'Węzły SFN', GitBranch], ['psi', 'Tablice PSI/SI', Table2]] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="p-0">
          {tab === 'kanaly' && (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 text-left">LCN</th><th className="px-4 py-3 text-left">Nazwa</th>
                <th className="px-4 py-3 text-left">Format</th><th className="px-4 py-3 text-left">Bitrate</th>
                <th className="px-4 py-3 text-left">StatMux</th><th className="px-4 py-3 text-left">HbbTV</th>
                <th className="px-4 py-3 text-left">Teletext</th><th className="px-4 py-3 text-left">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {mux.channels.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{c.lcn}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.video_format}</td>
                    <td className="px-4 py-3 text-gray-500">{c.video_bitrate_mbps} Mbps</td>
                    <td className="px-4 py-3"><div className="w-24"><div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${c.statmux_weight}%` }} /></div></div></td>
                    <td className="px-4 py-3">{c.hbbtv_enabled ? <span className="text-green-600 text-xs">✓</span> : <span className="text-gray-300 text-xs">–</span>}</td>
                    <td className="px-4 py-3">{c.teletext_enabled ? <span className="text-green-600 text-xs">✓</span> : <span className="text-gray-300 text-xs">–</span>}</td>
                    <td className="px-4 py-3"><StatusBadge value={c.status} type="channel" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'sfn' && (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 text-left">Nazwa</th><th className="px-4 py-3 text-left">Lokalizacja</th>
                <th className="px-4 py-3 text-left">Moc (W)</th><th className="px-4 py-3 text-left">Opóźnienie</th>
                <th className="px-4 py-3 text-left">GPS</th><th className="px-4 py-3 text-left">MIP</th><th className="px-4 py-3 text-left">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {mux.sfn_nodes.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{n.name}</td>
                    <td className="px-4 py-3 text-gray-500">{n.location}</td>
                    <td className="px-4 py-3 text-gray-500">{n.power_w?.toLocaleString()} W</td>
                    <td className="px-4 py-3 text-gray-500">{n.delay_us} µs</td>
                    <td className="px-4 py-3">{n.gps_sync ? <span className="text-green-600 text-xs">✓ GPS</span> : <span className="text-gray-400 text-xs">Oscylator</span>}</td>
                    <td className="px-4 py-3">{n.gps_sync ? <span className="text-green-600 text-xs">✓</span> : <span className="text-gray-300 text-xs">–</span>}</td>
                    <td className="px-4 py-3"><StatusBadge value={n.status} type="sfn" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'psi' && (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 text-left">Tablica</th><th className="px-4 py-3 text-left">PID</th>
                <th className="px-4 py-3 text-left">Wersja</th><th className="px-4 py-3 text-left">Cykl (ms)</th><th className="px-4 py-3 text-left">Aktywna</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {mux.psi_si.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">{t.table_type}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">0x{t.pid?.toString(16).toUpperCase().padStart(4, '0')}</td>
                    <td className="px-4 py-3 text-gray-500">{t.version}</td>
                    <td className="px-4 py-3 text-gray-500">{t.cycle_ms}</td>
                    <td className="px-4 py-3">{t.enabled ? <span className="text-green-600 text-xs">✓ Tak</span> : <span className="text-red-400 text-xs">✗ Nie</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
