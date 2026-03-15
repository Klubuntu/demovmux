'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Radio, Tv2, GitBranch, Pencil, Trash2, Wifi } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import BitrateBar from '@/components/BitrateBar';
import Modal from '@/components/Modal';
import FieldHint from '@/components/FieldHint';

interface Mux {
  id: number; name: string; number: number; standard: string; mux_type: string; radio_enabled: number; video_codec: string;
  modulation: string; fft_mode: string; guard_interval: string; fec: string;
  bandwidth_mhz: number; frequency_band: string; frequency_mhz: number; channel_number: number;
  polarization: string; network_id: number; ts_id: number; onid: number;
  total_bitrate_mbps: number; sfn_enabled: number; status: string; notes: string;
  channel_count: number; sfn_count: number;
}

const defaultMux: Partial<Mux> = {
  name: '', number: 0, standard: 'DVB-T2', mux_type: 'terrestrial', radio_enabled: 0, video_codec: 'HEVC', modulation: '256-QAM',
  fft_mode: '32k Extended', guard_interval: '19/256', fec: '2/3', bandwidth_mhz: 8,
  frequency_band: 'UHF', frequency_mhz: 514, channel_number: 26, polarization: 'H',
  network_id: 8202, ts_id: 0, onid: 8202, total_bitrate_mbps: 36.1, sfn_enabled: 1,
  status: 'active', notes: '',
};

export default function MultipleksyPage() {
  const [muxes, setMuxes] = useState<Mux[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Mux>>(defaultMux);
  const [isEdit, setIsEdit] = useState(false);

  const load = () => fetch('/api/multiplexes').then(r => r.json()).then(setMuxes);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(defaultMux); setIsEdit(false); setModal(true); };
  const openEdit = (m: Mux) => { setEditing(m); setIsEdit(true); setModal(true); };

  const save = async () => {
    if (isEdit) {
      await fetch(`/api/multiplexes/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    } else {
      await fetch('/api/multiplexes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    }
    setModal(false);
    load();
  };

  const del = async (id: number) => {
    if (!confirm('Usunąć ten multipleks i wszystkie jego kanały?')) return;
    await fetch(`/api/multiplexes/${id}`, { method: 'DELETE' });
    load();
  };

  const f = (k: keyof Mux, v: string | number) => setEditing(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Multipleksy</h2>
          <p className="text-sm text-gray-500">Konfiguracja wirtualnych strumieni TS (DVB-T/T2)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Dodaj MUX
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {muxes.map(m => (
          <div key={m.id} className={`bg-white rounded-xl border p-5 ${m.mux_type === 'iptv' ? 'border-indigo-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${m.mux_type === 'iptv' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'}`}>
                  {m.mux_type === 'iptv' ? <Wifi size={18} /> : m.number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{m.name}</h3>
                    <StatusBadge value={m.status} type="mux" />
                    {m.mux_type === 'iptv' && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">IPTV</span>
                    )}
                    {m.mux_type === 'radio' && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-semibold">Radio MUX</span>
                    )}
                    {m.radio_enabled === 1 && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-semibold">📻 Radio</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{m.standard} · {m.video_codec} · {m.mux_type === 'iptv' ? 'Stream IP' : m.modulation}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/multipleksy/${m.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Radio size={15} />
                </Link>
                <button onClick={() => openEdit(m)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => del(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {m.mux_type === 'iptv' ? (
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div className="bg-indigo-50 rounded-lg px-3 py-2 col-span-2">
                  <p className="text-indigo-400">Typ strumienia</p>
                  <p className="font-medium text-indigo-800">Strumień IP · HLS / RTMP / SRT / DASH / MLD</p>
                </div>
                <div className="bg-indigo-50 rounded-lg px-3 py-2">
                  <p className="text-indigo-400">Sieć</p>
                  <p className="font-medium text-indigo-800">ONID {m.onid}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-gray-400">Częstotliwość</p>
                  <p className="font-medium text-gray-800">{m.frequency_mhz} MHz (UKF {m.channel_number})</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-gray-400">FFT / GI</p>
                  <p className="font-medium text-gray-800">{m.fft_mode} / {m.guard_interval}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-gray-400">FEC / Pasmo</p>
                  <p className="font-medium text-gray-800">{m.fec} · {m.bandwidth_mhz} MHz</p>
                </div>
              </div>
            )}

            <BitrateBar used={m.total_bitrate_mbps * 0.85} total={m.total_bitrate_mbps} label="Przepływność TS" />

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Tv2 size={12} /> {m.channel_count} kanałów</span>
              <span className="flex items-center gap-1"><GitBranch size={12} /> {m.sfn_count} węzłów SFN</span>
              {m.mux_type === 'iptv' ? (
                <span className="ml-auto flex items-center gap-1"><Wifi size={12} className="text-indigo-400" /> Stream IP</span>
              ) : (
                <span className="ml-auto">{m.frequency_band} · Polar. {m.polarization}</span>
              )}
              {m.radio_enabled === 1 && (
                <span className="flex items-center gap-1 text-teal-600">📻 Radio/Icecast</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal title={isEdit ? `Edytuj ${editing.name}` : 'Nowy Multipleks'} open={modal} onClose={() => setModal(false)} size="xl">
        <div className="grid grid-cols-2 gap-4">
          {([
            ['name', 'Nazwa', 'text'],
            ['number', 'Numer MUX', 'number', undefined, 'Unikalny numer identyfikacyjny multipleksu w sieci DVB (np. 1–8 dla naziemnej).'],
            ['mux_type', 'Typ MUX', 'select', ['terrestrial', 'iptv', 'radio', 'satellite', 'cable'], 'terrestrial = naziemny DVB-T/T2 · iptv = platforma internetowa · radio = multipleks radiowy / audio · satellite = satelitarny · cable = kablowy DVB-C'],
            ['radio_enabled', 'Obsługa radia (Icecast)', 'select', ['0', '1'], 'Włącza możliwość dodania kanałów radiowych (audio-only) przesyłanych przez Icecast/Shoutcast do tego multipleksu.'],
            ['standard', 'Standard', 'select', ['DVB-T2', 'DVB-T', 'IPTV', 'DVB-S2', 'DVB-C'], 'Norma transmisji cyfrowej. DVB-T2 to aktualny standard naziemny w Polsce (obowiązuje od 2022).'],
            ['video_codec', 'Kodek wideo', 'select', ['HEVC', 'MPEG-4', 'MPEG-2', 'H.264', 'H.265'], 'HEVC (H.265) wymagany dla DVB-T2 w Polsce. MPEG-2 stosowany w starszych MUX-ach DVB-T.'],
            ['modulation', 'Modulacja', 'select', ['256-QAM', '64-QAM', '16-QAM', 'QPSK', 'N/A'], '256-QAM = maksymalna przepływność, wymaga dobrego sygnału. 64-QAM = większa odporność na zakłócenia i szerszy zasięg.'],
            ['fft_mode', 'Tryb FFT', 'select', ['32k Extended', '32k', '16k', '8k', '4k', '2k', '1k', 'N/A'], 'Rozmiar transformaty Fouriera dla OFDM. 32k = max pojemność i zasięg SFN (dłuższe symbole OFDM). Mniejsze wartości = mniejsze opóźnienie (mobilność).'],
            ['guard_interval', 'Odstęp ochronny', 'select', ['19/256', '19/128', '1/8', '1/4', '1/16', '1/32', '1/128', 'N/A'], 'Przerwa między symbolami OFDM chroniąca przed echem wielodrożnym. 19/256 ≈ 58 µs — typowy wybór dla sieci SFN 8 MHz.'],
            ['fec', 'FEC', 'select', ['1/2', '3/5', '2/3', '3/4', '4/5', '5/6', 'N/A'], 'Forward Error Correction — korekcja błędów. 2/3 = dobry kompromis odporność/przepływność. Niższy ułamek = lepsza ochrona, niższy bitrate.'],
            ['bandwidth_mhz', 'Szerokość kanału (MHz)', 'number', undefined, 'Szerokość kanału RF w MHz. W Polsce standardowo 8 MHz (UHF). Niektóre kraje używają 7 lub 6 MHz.'],
            ['frequency_band', 'Pasmo', 'select', ['UHF', 'VHF'], 'UHF (470–862 MHz) — standard DVB-T/T2 w Polsce. VHF stosowane w niektórych krajach dla dolnych multipleksów.'],
            ['frequency_mhz', 'Częstotliwość (MHz)', 'number', undefined, 'Centralna częstotliwość kanału RF w MHz (np. 514 MHz to kanał 26 UHF).'],
            ['channel_number', 'Numer kanału RF', 'number', undefined, 'Numer kanału UHF/VHF wg planu częstotliwości CEPT (UHF: 21–60). Jednoznacznie wyznacza częstotliwość środkową.'],
            ['polarization', 'Polaryzacja', 'select', ['H', 'V'], 'Polaryzacja sygnału antenowego. H = pozioma (dominuje w Polsce), V = pionowa.'],
            ['network_id', 'Network ID', 'number', undefined, 'NID: identyfikator sieci DVB (0–65535) wpisywany do tablicy NIT. W Polsce Emitel używa 8202.'],
            ['ts_id', 'TS ID', 'number', undefined, 'Transport Stream ID — identyfikator strumienia TS w obrębie sieci. Musi być unikalny w ramach Network ID.'],
            ['onid', 'ONID', 'number', undefined, 'Original Network ID — identyfikator sieci macierzystej, w której usługa została pierwotnie zdefiniowana. Zwykle równy Network ID.'],
            ['total_bitrate_mbps', 'Max bitrate (Mbps)', 'number', undefined, 'Łączna przepływność strumienia TS w Mbit/s. Dla DVB-T2 8 MHz / 256-QAM / FEC 2/3 / FFT 32k / GI 19/256 wynosi ≈ 36.1 Mbps.'],
            ['sfn_enabled', 'SFN', 'select', ['1', '0'], 'Single Frequency Network — synchronizacja wielu nadajników na tej samej częstotliwości. Wymaga pakietów MIP i synchronizacji GPS w każdym węźle.'],
            ['status', 'Status', 'select', ['active', 'maintenance', 'inactive']],
          ] as [keyof Mux, string, string, string[]?, string?][]).map(([key, label, type, opts, hint]) => (
            <div key={key}>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                {label}{hint && <FieldHint text={hint} />}
              </label>
              {type === 'select' ? (
                <select value={String(editing[key] ?? '')} onChange={e => f(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {opts?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={type} value={String(editing[key] ?? '')} onChange={e => f(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Notatki</label>
            <textarea rows={2} value={editing.notes ?? ''} onChange={e => f('notes', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">Anuluj</button>
          <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zapisz</button>
        </div>
      </Modal>
    </div>
  );
}
