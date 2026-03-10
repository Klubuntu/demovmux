'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Filter } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

interface Event {
  id: number; severity: string; source: string; mux_id: number | null; message: string;
  details: string; resolved: number; resolved_at: string | null; created_at: string;
  mux_name?: string; channel_name?: string;
}
interface Mux { id: number; name: string; }

const SEVERITY_ICONS: Record<string, React.ElementType> = {
  info: Info, warning: AlertTriangle, error: XCircle, critical: XCircle,
};
const SEVERITY_COLOR: Record<string, string> = {
  info: 'text-blue-500', warning: 'text-yellow-500', error: 'text-red-500', critical: 'text-red-700',
};
const SEVERITY_BG: Record<string, string> = {
  info: 'bg-blue-50', warning: 'bg-yellow-50', error: 'bg-red-50', critical: 'bg-red-100',
};

export default function ZdarzeniaPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [muxes, setMuxes] = useState<Mux[]>([]);
  const [filterMux, setFilterMux] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [limit, setLimit] = useState(50);
  const [resolving, setResolving] = useState<number | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (filterMux) params.set('mux_id', filterMux);
    if (filterSeverity) params.set('severity', filterSeverity);
    fetch(`/api/events?${params}`).then(r => r.json()).then(setEvents);
  }, [filterMux, filterSeverity, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch('/api/multiplexes').then(r => r.json()).then(setMuxes); }, []);

  const resolve = async (id: number) => {
    setResolving(id);
    await fetch(`/api/events/${id}`, { method: 'PUT' });
    load();
    setResolving(null);
  };

  const unresolved = events.filter(e => !e.resolved).length;
  const bySeverity = {
    critical: events.filter(e => e.severity === 'critical' && !e.resolved).length,
    error: events.filter(e => e.severity === 'error' && !e.resolved).length,
    warning: events.filter(e => e.severity === 'warning' && !e.resolved).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zdarzenia i Logi</h2>
          <p className="text-sm text-gray-500">Historia alarmów, komunikatów systemowych i zmian konfiguracji</p>
        </div>
        <div className="flex items-center gap-2">
          {unresolved > 0 && (
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
              {unresolved} nierozwiązanych
            </span>
          )}
        </div>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-3 gap-3">
        {([['critical', 'Krytyczne', 'bg-red-50 border-red-100'], ['error', 'Błędy', 'bg-red-50 border-red-100'], ['warning', 'Ostrzeżenia', 'bg-yellow-50 border-yellow-100']] as const).map(([sev, label, cls]) => (
          <div key={sev} className={`rounded-xl border p-4 flex items-center gap-3 ${cls}`}>
            <XCircle size={20} className={sev === 'warning' ? 'text-yellow-500' : 'text-red-500'} />
            <div>
              <p className="text-xs text-gray-500">{label} (aktywne)</p>
              <p className="text-2xl font-bold text-gray-900">{bySeverity[sev]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        <select value={filterMux} onChange={e => setFilterMux(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Wszystkie MUX</option>
          {muxes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Wszystkie poziomy</option>
          <option value="critical">Krytyczny</option>
          <option value="error">Błąd</option>
          <option value="warning">Ostrzeżenie</option>
          <option value="info">Info</option>
        </select>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={25}>25 wyników</option>
          <option value={50}>50 wyników</option>
          <option value={100}>100 wyników</option>
        </select>
        <button onClick={load} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Odśwież</button>
        <span className="ml-auto text-xs text-gray-400">{events.length} zdarzeń</span>
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {events.map(ev => {
          const Icon = SEVERITY_ICONS[ev.severity] ?? Info;
          return (
            <div key={ev.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${ev.severity === 'critical' ? 'border-red-200' : ''}`}>
              <div className={`flex items-start gap-4 p-4 ${ev.resolved ? '' : SEVERITY_BG[ev.severity]}`}>
                <Icon size={18} className={`mt-0.5 flex-shrink-0 ${ev.resolved ? 'text-gray-300' : SEVERITY_COLOR[ev.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${ev.resolved ? 'text-gray-500' : 'text-gray-900'}`}>{ev.message}</span>
                        <StatusBadge value={ev.severity} type="severity" />
                        {ev.mux_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ev.mux_name}</span>}
                      </div>
                      {ev.details && <p className="text-xs text-gray-500 mt-1">{ev.details}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{new Date(ev.created_at).toLocaleString('pl')}</span>
                        <span>·</span>
                        <span>Źródło: {ev.source}</span>
                        {ev.resolved && ev.resolved_at && <span>· Rozwiązano: {new Date(ev.resolved_at).toLocaleString('pl')}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {ev.resolved ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle2 size={12} /> Rozwiązane
                        </span>
                      ) : (
                        <button onClick={() => resolve(ev.id)} disabled={resolving === ev.id}
                          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-50 transition-colors">
                          {resolving === ev.id ? '…' : 'Rozwiąż'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <CheckCircle2 size={32} className="mx-auto text-green-300 mb-2" />
            Brak zdarzeń spełniających kryteria filtrowania
          </div>
        )}
      </div>
    </div>
  );
}
