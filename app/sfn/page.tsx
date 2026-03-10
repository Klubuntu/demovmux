'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, MapPin, Zap, Clock } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

interface SFNNode {
  id: number; mux_id: number; mux_name: string; name: string; location: string;
  latitude: number; longitude: number; power_w: number; antenna_height_m: number;
  frequency_mhz: number; mip_enabled: number; gps_sync: number; delay_us: number; status: string;
}
interface Mux { id: number; name: string; }

const defaultNode: Partial<SFNNode> = {
  name: '', location: '', latitude: 52.0, longitude: 19.0, power_w: 1000,
  antenna_height_m: 100, frequency_mhz: 514, mip_enabled: 1, gps_sync: 1, delay_us: 0, status: 'active',
};

export default function SFNPage() {
  const [nodes, setNodes] = useState<SFNNode[]>([]);
  const [muxes, setMuxes] = useState<Mux[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<SFNNode>>(defaultNode);
  const [isEdit, setIsEdit] = useState(false);
  const [filterMux, setFilterMux] = useState('');

  const load = useCallback(() => {
    const q = filterMux ? `?mux_id=${filterMux}` : '';
    fetch(`/api/sfn${q}`).then(r => r.json()).then(setNodes);
  }, [filterMux]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch('/api/multiplexes').then(r => r.json()).then(setMuxes); }, []);

  const openCreate = () => { setEditing({ ...defaultNode, mux_id: muxes[0]?.id }); setIsEdit(false); setModal(true); };
  const openEdit = (n: SFNNode) => { setEditing(n); setIsEdit(true); setModal(true); };
  const del = async (id: number) => {
    if (!confirm('Usunąć węzeł SFN?')) return;
    await fetch(`/api/sfn/${id}`, { method: 'DELETE' }); load();
  };
  const save = async () => {
    if (isEdit) {
      await fetch(`/api/sfn/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    } else {
      await fetch('/api/sfn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    }
    setModal(false); load();
  };
  const f = (k: keyof SFNNode, v: string | number) => setEditing(p => ({ ...p, [k]: v }));

  const statusCounts = {
    active: nodes.filter(n => n.status === 'active').length,
    alarm: nodes.filter(n => n.status === 'alarm').length,
    maintenance: nodes.filter(n => n.status === 'maintenance').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Węzły SFN</h2>
          <p className="text-sm text-gray-500">Sieć jednoczęstotliwościowa – nadajniki z synchronizacją MIP/GPS</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Dodaj węzeł
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3">
        <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">{statusCounts.active} aktywnych</span>
        {statusCounts.alarm > 0 && <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium">{statusCounts.alarm} alarmów</span>}
        {statusCounts.maintenance > 0 && <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-medium">{statusCounts.maintenance} w konserwacji</span>}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-500">MUX:</label>
          <select value={filterMux} onChange={e => setFilterMux(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Wszystkie</option>
            {muxes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left">Węzeł</th>
              <th className="px-4 py-3 text-left">MUX</th>
              <th className="px-4 py-3 text-left">Lokalizacja</th>
              <th className="px-4 py-3 text-left">Moc</th>
              <th className="px-4 py-3 text-left">Wys. ant.</th>
              <th className="px-4 py-3 text-left">Częst.</th>
              <th className="px-4 py-3 text-left">Opóźnienie</th>
              <th className="px-4 py-3 text-left">GPS/MIP</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {nodes.map(n => (
              <tr key={n.id} className={`hover:bg-gray-50 transition-colors ${n.status === 'alarm' ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{n.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{n.mux_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <MapPin size={11} className="text-gray-400" />
                    {n.location}
                  </div>
                  <div className="text-[10px] text-gray-300 font-mono">{n.latitude?.toFixed(4)}°N {n.longitude?.toFixed(4)}°E</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-700 text-xs">
                    <Zap size={11} className="text-yellow-500" />
                    {n.power_w?.toLocaleString()} W
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{n.antenna_height_m} m</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{n.frequency_mhz} MHz</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-600 text-xs">
                    <Clock size={11} className="text-gray-400" />
                    {n.delay_us} µs
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs space-y-0.5">
                    <div className={n.gps_sync ? 'text-green-600' : 'text-gray-400'}>{n.gps_sync ? '✓ GPS sync' : '○ Oscylator'}</div>
                    <div className={n.mip_enabled ? 'text-blue-600' : 'text-gray-400'}>{n.mip_enabled ? '✓ MIP' : '○ bez MIP'}</div>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge value={n.status} type="sfn" /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(n)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => del(n.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nodes.length === 0 && <div className="text-center py-12 text-gray-400">Brak węzłów SFN</div>}
      </div>

      <Modal title={isEdit ? `Edytuj: ${editing.name}` : 'Nowy węzeł SFN'} open={modal} onClose={() => setModal(false)} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Multipleks</label>
            <select value={editing.mux_id ?? ''} onChange={e => f('mux_id', Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {muxes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {([
            ['name', 'Nazwa węzła', 'text'], ['location', 'Lokalizacja', 'text'],
            ['latitude', 'Szerokość geogr. (N)', 'number'], ['longitude', 'Długość geogr. (E)', 'number'],
            ['power_w', 'Moc (W)', 'number'], ['antenna_height_m', 'Wysokość anteny (m)', 'number'],
            ['frequency_mhz', 'Częstotliwość (MHz)', 'number'], ['delay_us', 'Opóźnienie (µs)', 'number'],
            ['mip_enabled', 'MIP', 'select', ['1', '0']], ['gps_sync', 'GPS sync', 'select', ['1', '0']],
            ['status', 'Status', 'select', ['active', 'maintenance', 'inactive', 'alarm']],
          ] as [keyof SFNNode, string, string, string[]?][]).map(([key, label, type, opts]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              {type === 'select' ? (
                <select value={String(editing[key] ?? '')} onChange={e => f(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {opts?.map(o => <option key={o} value={o}>{o === '1' ? 'Tak' : o === '0' ? 'Nie' : o}</option>)}
                </select>
              ) : (
                <input type={type} step={type === 'number' ? 'any' : undefined} value={String(editing[key] ?? '')} onChange={e => f(key, type === 'number' ? Number(e.target.value) : e.target.value)}
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
