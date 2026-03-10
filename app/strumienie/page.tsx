'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Wifi, WifiOff, AlertCircle, Clock, Globe, Satellite, Radio, Waves } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import FieldHint from '@/components/FieldHint';

interface Stream {
  id: number; name: string; broadcaster: string; type: string; protocol: string;
  source_address: string; source_port: number; bitrate_mbps: number;
  redundancy_mode: string; encryption: string; status: string; last_seen_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  fiber: Waves, satellite: Satellite, microwave: Radio, ip_srt: Globe,
  ip_rist: Globe, backhaul: Wifi, offair: Wifi,
};

const typeLabels: Record<string, string> = {
  fiber: 'Światłowód', satellite: 'Satelita', microwave: 'Radiolinia',
  ip_srt: 'IP/SRT', ip_rist: 'IP/RIST', backhaul: 'Backhaul', offair: 'Off-Air',
};

const typeBg: Record<string, string> = {
  fiber: 'bg-blue-50 text-blue-600', satellite: 'bg-purple-50 text-purple-600',
  microwave: 'bg-orange-50 text-orange-600', ip_srt: 'bg-green-50 text-green-600',
  ip_rist: 'bg-teal-50 text-teal-600', backhaul: 'bg-gray-50 text-gray-600',
  offair: 'bg-yellow-50 text-yellow-600',
};

const defaultStream: Partial<Stream> = {
  name: '', broadcaster: '', type: 'fiber', protocol: 'ASI', source_address: '',
  source_port: 5004, bitrate_mbps: 50, redundancy_mode: 'primary', encryption: 'none', status: 'active',
};

export default function StrumieniaPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Stream>>(defaultStream);
  const [isEdit, setIsEdit] = useState(false);

  const load = () => fetch('/api/streams').then(r => r.json()).then(setStreams);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(defaultStream); setIsEdit(false); setModal(true); };
  const openEdit = (s: Stream) => { setEditing(s); setIsEdit(true); setModal(true); };
  const del = async (id: number) => {
    if (!confirm('Usunąć strumień wejściowy?')) return;
    await fetch(`/api/streams/${id}`, { method: 'DELETE' }); load();
  };
  const save = async () => {
    if (isEdit) {
      await fetch(`/api/streams/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    } else {
      await fetch('/api/streams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    }
    setModal(false); load();
  };
  const f = (k: keyof Stream, v: string | number) => setEditing(p => ({ ...p, [k]: v }));

  const statusIcon = (s: string) => {
    if (s === 'active') return <Wifi size={14} className="text-green-500" />;
    if (s === 'error') return <AlertCircle size={14} className="text-red-500" />;
    if (s === 'standby') return <Clock size={14} className="text-blue-500" />;
    return <WifiOff size={14} className="text-gray-400" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Strumienie wejściowe</h2>
          <p className="text-sm text-gray-500">Dosył sygnału od nadawców do stacji czołowej (headend)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Dodaj strumień
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {streams.map(s => {
          const Icon = typeIcons[s.type] ?? Wifi;
          return (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeBg[s.type] ?? 'bg-gray-50 text-gray-500'}`}>
                    <Icon size={15} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.broadcaster}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil size={13} /></button>
                  <button onClick={() => del(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Typ:</span>
                  <span className="font-medium text-gray-700">{typeLabels[s.type] ?? s.type} · {s.protocol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Adres:</span>
                  <span className="font-mono text-gray-700">{s.source_address}{s.source_port ? `:${s.source_port}` : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Bitrate:</span>
                  <span className="font-medium text-gray-700">{s.bitrate_mbps} Mbps</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Szyfrowanie:</span>
                  <span className={`font-medium ${s.encryption !== 'none' ? 'text-green-600' : 'text-gray-400'}`}>{s.encryption}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Tryb:</span>
                  <span className="text-gray-600 capitalize">{s.redundancy_mode}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">{statusIcon(s.status)}<StatusBadge value={s.status} type="stream" /></div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal title={isEdit ? `Edytuj: ${editing.name}` : 'Nowy strumień wejściowy'} open={modal} onClose={() => setModal(false)} size="lg">
        <div className="grid grid-cols-2 gap-4">
          {([
            ['name', 'Nazwa', 'text'],
            ['broadcaster', 'Nadawca', 'text'],
            ['type', 'Typ łącza', 'select', ['fiber', 'satellite', 'microwave', 'ip_srt', 'ip_rist', 'backhaul', 'offair'], 'Fizyczne medium dosyłu: Światłowód = ASI/IP po kablach, Satelita = DVB-S2, Radiolinia = mikrofale, IP/SRT = internet z szyfrowaniem, Backhaul = łącze agregacyjne.'],
            ['protocol', 'Protokół', 'text', undefined, 'Protokół warstwy transportowej sygnału (np. ASI, UDP, RTP, SRT, RIST, HLS). Wpisz ręcznie zgodnie z konfiguracją kodera/nadajnika.'],
            ['source_address', 'Adres źródłowy', 'text', undefined, 'Adres IP lub hostname hosta źródłowego sygnału (np. 10.0.0.100 lub encoder.nadawca.pl). Przy ASI zostaw puste.'],
            ['source_port', 'Port', 'number', undefined, 'Numer portu UDP/TCP: RTP = 5004, SRT = 4201, RTMP = 1935, RIST = 5004. Przy łączu ASI (fizycznym) wpisz 0.'],
            ['bitrate_mbps', 'Bitrate (Mbps)', 'number', undefined, 'Oczekiwana/nominalna przepływność sygnału wejściowego w Mbit/s. Używana do monitorowania i wyzwalania alarmów odchylenia.'],
            ['redundancy_mode', 'Tryb redundancji', 'select', ['none', 'primary', 'backup'], 'primary = główny tor sygnałowy · backup = zapasowy (przełączany przy awarii toru primary) · none = brak redundancji.'],
            ['encryption', 'Szyfrowanie', 'text', undefined, 'Typ szyfrowania sygnału dosyłowego (np. none, AES-128, AES-256, BISS-1, BISS-E). Wpisz ręcznie lub "none".'],
            ['status', 'Status', 'select', ['active', 'inactive', 'error', 'standby']],
          ] as [keyof Stream, string, string, string[]?, string?][]).map(([key, label, type, opts, hint]) => (
            <div key={key}>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                {label}{hint && <FieldHint text={hint} />}
              </label>
              {type === 'select' ? (
                <select value={String(editing[key] ?? '')} onChange={e => f(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {opts?.map(o => <option key={o} value={o}>{typeLabels[o] ?? o}</option>)}
                </select>
              ) : (
                <input type={type} value={String(editing[key] ?? '')} onChange={e => f(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">Anuluj</button>
          <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zapisz</button>
        </div>
      </Modal>
    </div>
  );
}
