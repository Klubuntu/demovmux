'use client';
import { useEffect, useState } from 'react';
import { Database, Info, RefreshCw, CheckCircle2, AlertTriangle, WifiOff, HardDrive, Server } from 'lucide-react';

interface SystemInfo {
  dbType: string;
  version: string;
  counts: {
    multiplexes: number;
    channels: number;
    sfnNodes: number;
    streams: number;
    events: number;
  };
}

type ServiceStatus = { status: 'active' | 'maintenance' | 'blocked'; message: string | null };

const STATUS_CFG = {
  active:      { label: 'Aktywny',      color: 'border-green-400 bg-green-50 text-green-700',   dot: 'bg-green-500',  Icon: CheckCircle2 },
  maintenance: { label: 'Konserwacja',  color: 'border-orange-400 bg-orange-50 text-orange-700', dot: 'bg-orange-400', Icon: AlertTriangle },
  blocked:     { label: 'Zablokowany',  color: 'border-red-400 bg-red-50 text-red-700',          dot: 'bg-red-500',    Icon: WifiOff },
} as const;

export default function UstawieniaPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [svc, setSvc] = useState<ServiceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setInfo);
    fetch('/api/status').then(r => r.json()).then((d: ServiceStatus) => {
      setSvc(d);
      setMessage(d?.message ?? '');
    });
  }, []);

  const changeStatus = async (newStatus: ServiceStatus['status']) => {
    setSaving(true);
    const res = await fetch('/api/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, message }),
    });
    setSvc(await res.json());
    setSaving(false);
  };

  const saveMessage = async () => {
    if (!svc) return;
    setSaving(true);
    const res = await fetch('/api/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: svc.status, message }),
    });
    setSvc(await res.json());
    setSaving(false);
  };

  const seedData = async () => {
    setSeeding(true);
    setSeedMsg('');
    const res = await fetch('/api/setup', { method: 'POST' });
    const data = await res.json();
    setSeeding(false);
    if (data.ok) {
      setSeedMsg('✓ Dane przykładowe zostały wstawione.');
      fetch('/api/settings').then(r => r.json()).then(setInfo);
    } else {
      setSeedMsg('Błąd: ' + (data.error ?? 'nieznany błąd'));
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Ustawienia systemu</h2>
        <p className="text-sm text-gray-500">Konfiguracja i zarządzanie platformą vMUX</p>
      </div>

      {/* Status systemu */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Server size={15} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Status systemu</p>
            <p className="text-xs text-gray-400">Stan widoczny dla użytkowników platformy</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(STATUS_CFG) as [ServiceStatus['status'], typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([s, cfg]) => {
              const active = svc?.status === s;
              const { Icon } = cfg;
              return (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    active ? cfg.color : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {active
                    ? <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    : <Icon size={14} className="text-gray-300" />}
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Komunikat dla użytkowników</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveMessage()}
                placeholder="np. Planowana przerwa techniczna 20:00–22:00"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={saveMessage}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {saving ? '…' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Baza danych */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Database size={15} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Baza danych</p>
            <p className="text-xs text-gray-400">{info?.dbType ?? '…'}</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {([
              ['Multipleksy', info?.counts.multiplexes],
              ['Kanały', info?.counts.channels],
              ['Węzły SFN', info?.counts.sfnNodes],
              ['Strumienie', info?.counts.streams],
              ['Zdarzenia', info?.counts.events],
            ] as [string, number | undefined][]).map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dane */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <HardDrive size={15} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Zarządzanie danymi</p>
            <p className="text-xs text-gray-400">Dane przykładowe i inicjalizacja bazy</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Dane przykładowe</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Wstawia przykładowe multipleksy, kanały, węzły SFN i zdarzenia
              </p>
            </div>
            <button
              onClick={seedData}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={13} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Wstawianie…' : 'Wstaw dane'}
            </button>
          </div>
          {seedMsg && (
            <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${
              seedMsg.startsWith('Błąd') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {seedMsg}
            </p>
          )}
        </div>
      </div>

      {/* O systemie */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Info size={15} className="text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">O systemie</p>
            <p className="text-xs text-gray-400">vMUX Panel v{info?.version ?? '1.0.0'}</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {([
            ['Wersja', info?.version ?? '1.0.0'],
            ['Framework', 'Next.js 15 (App Router)'],
            ['Baza danych', info?.dbType ?? '…'],
            ['Środowisko', process.env.NODE_ENV ?? 'production'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-mono text-gray-700 text-xs bg-gray-50 px-2 py-0.5 rounded">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
