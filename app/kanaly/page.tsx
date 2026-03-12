'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Wifi, CalendarDays, Music } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import FieldHint from '@/components/FieldHint';

interface Channel {
  id: number; mux_id: number; mux_name: string; mux_type: string;
  name: string; short_name: string;
  lcn: number; service_id: number; pmt_pid: number; video_pid: number; audio_pid: number;
  pcr_pid: number; video_format: string; video_bitrate_mbps: number; audio_bitrate_kbps: number;
  statmux_weight: number; statmux_min_mbps: number; statmux_max_mbps: number;
  hbbtv_enabled: number; hbbtv_url: string; teletext_enabled: number; ssu_enabled: number;
  input_stream_id: number; status: string;
  stream_url: string | null; stream_type: string | null;
  epg_source_url: string | null; epg_channel_id: string | null;
  channel_type: string; audio_codec: string; sample_rate_hz: number; stereo_mode: string;
}

interface Mux { id: number; name: string; number: number; mux_type: string; radio_enabled: number; }
interface InputStream {
  id: number;
  name: string;
  broadcaster?: string | null;
  type?: string | null;
  protocol?: string | null;
  source_address?: string | null;
  source_port?: number | null;
  bitrate_mbps?: number | null;
  status?: string;
}

const defaultCh: Partial<Channel> = {
  name: '', short_name: '', lcn: 0, service_id: 0, pmt_pid: 4096, video_pid: 4097,
  audio_pid: 4098, pcr_pid: 4097, video_format: 'HD 1080i', video_bitrate_mbps: 5,
  audio_bitrate_kbps: 192, statmux_weight: 50, statmux_min_mbps: 2, statmux_max_mbps: 8,
  hbbtv_enabled: 0, hbbtv_url: '', teletext_enabled: 0, ssu_enabled: 0, status: 'active',
  stream_url: '', stream_type: 'hls', epg_source_url: '', epg_channel_id: '',
  channel_type: 'tv', audio_codec: 'AAC', sample_rate_hz: 48000, stereo_mode: 'stereo',
};

const STREAM_TYPE_COLORS: Record<string, string> = {
  hls:     'bg-blue-100 text-blue-700',
  rtmp:    'bg-orange-100 text-orange-700',
  srt:     'bg-purple-100 text-purple-700',
  dash:    'bg-green-100 text-green-700',
  udp:     'bg-gray-100 text-gray-700',
  rist:    'bg-pink-100 text-pink-700',
  icecast: 'bg-teal-100 text-teal-700',
};

export default function KanalyPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [muxes, setMuxes] = useState<Mux[]>([]);
  const [streams, setStreams] = useState<InputStream[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Channel>>(defaultCh);
  const [isEdit, setIsEdit] = useState(false);
  const [filterMux, setFilterMux] = useState('');

  const load = useCallback(() => {
    const q = filterMux ? `?mux_id=${filterMux}` : '';
    fetch(`/api/channels${q}`).then(r => r.json()).then(setChannels);
  }, [filterMux]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch('/api/multiplexes').then(r => r.json()).then(setMuxes); }, []);
  useEffect(() => { fetch('/api/streams').then(r => r.json()).then(setStreams); }, []);

  const selectedMux = muxes.find(m => m.id === (editing.mux_id ?? muxes[0]?.id));
  const selectedStream = streams.find(s => s.id === Number(editing.input_stream_id));
  const isIptv = selectedMux?.mux_type === 'iptv';
  const isRadio = editing.channel_type === 'radio' || selectedMux?.radio_enabled === 1;

  const openCreate = () => {
    const defaultMuxId = filterMux ? Number(filterMux) : (muxes[0]?.id ?? 0);
    setEditing({ ...defaultCh, mux_id: defaultMuxId });
    setIsEdit(false); setModal(true);
  };
  const openEdit = (c: Channel) => { setEditing(c); setIsEdit(true); setModal(true); };

  const save = async () => {
    try {
      const payload = {
        ...editing,
        input_stream_id: isIptv ? null : editing.input_stream_id,
      };
      if (isEdit) {
        const res = await fetch(`/api/channels/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Błąd: ${res.statusText}`);
      } else {
        const res = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Błąd: ${res.statusText}`);
      }
      setModal(false);
      await load();
    } catch (err) {
      alert(`Błąd przy zapisywaniu: ${err instanceof Error ? err.message : 'nieznany błąd'}`);
    }
  };

  const del = async (id: number) => {
    if (!confirm('Usunąć kanał?')) return;
    await fetch(`/api/channels/${id}`, { method: 'DELETE' }); load();
  };

  const f = (k: keyof Channel, v: string | number | null) => setEditing(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Kanały</h2>
              <p className="text-sm text-gray-500">Zarządzanie kanałami telewizyjnymi w multipleksach</p>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={16} /> Dodaj kanał
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Filtruj po MUX:</label>
            <select value={filterMux} onChange={e => setFilterMux(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Wszystkie</option>
              {muxes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span className="text-sm text-gray-400">{channels.length} kanałów</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left">LCN</th>
                  <th className="px-4 py-3 text-left">Kanał</th>
                  <th className="px-4 py-3 text-left">MUX</th>
                  <th className="px-4 py-3 text-left">Format / Strumień</th>
                  <th className="px-4 py-3 text-left">Bitrate</th>
                  <th className="px-4 py-3 text-left">StatMux %</th>
                  <th className="px-4 py-3 text-left">PMT PID</th>
                  <th className="px-4 py-3 text-left">HbbTV</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {channels.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono">{c.lcn}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">SID: {c.service_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{c.mux_name}</span>
                      {c.mux_type === 'iptv' && (
                        <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">IPTV</span>
                      )}
                      {c.channel_type === 'radio' && (
                        <span className="ml-1.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-semibold">📻 Radio</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.channel_type === 'radio' ? (
                        <div>
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${STREAM_TYPE_COLORS[c.stream_type ?? 'icecast'] ?? 'bg-teal-100 text-teal-700'}`}>
                            {(c.stream_type ?? 'Icecast').toUpperCase()}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">{c.audio_codec} · {(c.sample_rate_hz / 1000).toFixed(1)} kHz · {c.stereo_mode}</p>
                        </div>
                      ) : c.mux_type === 'iptv' && c.stream_url ? (
                        <div>
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${STREAM_TYPE_COLORS[c.stream_type ?? 'hls'] ?? 'bg-gray-100 text-gray-600'}`}>
                            {(c.stream_type ?? 'HLS').toUpperCase()}
                          </span>
                          <p className="text-xs text-gray-400 font-mono mt-0.5 max-w-xs truncate">{c.stream_url}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500">{c.video_format}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.video_bitrate_mbps} Mbps</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${c.statmux_weight}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{c.statmux_weight}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">0x{c.pmt_pid?.toString(16).toUpperCase()}</td>
                    <td className="px-4 py-3">{c.hbbtv_enabled ? <span className="text-green-600 text-xs font-medium">✓</span> : <span className="text-gray-300">–</span>}</td>
                    <td className="px-4 py-3"><StatusBadge value={c.status} type="channel" /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/epg?channel_id=${c.id}`} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="EPG">
                          <CalendarDays size={14} />
                        </Link>
                        {(c.mux_type === 'iptv' || c.channel_type === 'radio') && c.stream_url && (
                          <a href={c.stream_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg" title="Podgląd strumienia">
                            {c.channel_type === 'radio' ? <Music size={14} /> : <Wifi size={14} />}
                          </a>
                        )}
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg" title="Edytuj"><Pencil size={14} /></button>
                        <button onClick={() => del(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Usuń"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {channels.length === 0 && <div className="text-center py-12 text-gray-400">Brak kanałów</div>}
          </div>

          <Modal title={isEdit ? `Edytuj: ${editing.name}` : 'Nowy kanał'} open={modal} onClose={() => setModal(false)} size="xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Multipleks</label>
                <select value={editing.mux_id ?? ''} onChange={e => f('mux_id', Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {muxes.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.mux_type === 'iptv' ? ' [IPTV]' : ''}{m.radio_enabled ? ' [Radio]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!isIptv && (
                <div className="col-span-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                    Źródłowy strumień wejściowy <FieldHint text="Wskaż, z którego wejścia (input stream) kanał jest dostarczany do multipleksera. To pole mapuje kanał na rekord w tabeli input_streams." />
                  </label>
                  <select
                    value={String(editing.input_stream_id ?? '')}
                    onChange={e => f('input_stream_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Brak przypisania —</option>
                    {streams.map(s => (
                      <option key={s.id} value={s.id}>
                        #{s.id} · {s.name} {s.protocol ? `(${s.protocol.toUpperCase()})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedStream ? (
                    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      <p className="font-semibold">Wybrane źródło: {selectedStream.name}</p>
                      <p className="mt-0.5 text-blue-800">
                        ID: {selectedStream.id}
                        {selectedStream.type ? ` · Typ: ${selectedStream.type}` : ''}
                        {selectedStream.protocol ? ` · Protokół: ${selectedStream.protocol.toUpperCase()}` : ''}
                        {selectedStream.bitrate_mbps ? ` · Bitrate: ${selectedStream.bitrate_mbps} Mbps` : ''}
                      </p>
                      {(selectedStream.source_address || selectedStream.source_port) && (
                        <p className="mt-0.5 font-mono text-blue-700">
                          Źródło: {selectedStream.source_address ?? '-'}{selectedStream.source_port ? `:${selectedStream.source_port}` : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Kanał nie ma przypisanego źródła wejściowego.</p>
                  )}
                </div>
              )}

              {([
                ['name', 'Nazwa kanału', 'text'],
                ['short_name', 'Krótka nazwa', 'text', undefined, 'Skrócona nazwa (do 8 znaków) używana w tabelach SI/EPG i na niektórych pilotach DVB (pole short_name w SDT).'],
                ['lcn', 'LCN', 'number', undefined, 'Logical Channel Number — numer kanału na pilocie TV (np. TVP1 = 1). Wpisywany przez operatora do tablicy LCN w NIT.'],
                ['service_id', 'Service ID', 'number', undefined, 'SID: unikalny identyfikator usługi (kanału) wewnątrz strumienia TS (1–65535). Widoczny w tablicach PAT i SDT.'],
                ['pmt_pid', 'PMT PID', 'number', undefined, 'PID pakietów z tablicą PMT (Program Map Table) — opisuje, które PID-y należą do tej usługi (video, audio, teletext itp.).'],
                ['video_pid', 'Video PID', 'number', undefined, 'PID pakietów elementarnych (PES) niosących skompresowany sygnał wideo.'],
                ['audio_pid', 'Audio PID', 'number', undefined, 'PID pakietów elementarnych (PES) niosących skompresowany sygnał audio.'],
                ['pcr_pid', 'PCR PID', 'number', undefined, 'PID zawierający znaczniki PCR (Program Clock Reference) do synchronizacji zegara dekodera. Zwykle identyczny z Video PID.'],
                ['video_format', 'Format wideo', 'select', ['HD 1080i', 'HD 720p', 'SD 576i', '4K UHD', 'H.264 HD', 'H.265 HD'], 'Rozdzielczość i tryb skanowania (i = przeplot, p = progresywne). Wpływa na wyświetlaną ikonę HD/SD na TV.'],
                ['video_bitrate_mbps', 'Bitrate wideo (Mbps)', 'number', undefined, 'Docelowy/nominalny bitrate strumienia wideo w Mbit/s. Rzeczywisty może się różnić przy aktywnym StatMux.'],
                ['audio_bitrate_kbps', 'Bitrate audio (kbps)', 'number', undefined, 'Bitrate strumienia audio w kbit/s. Typowe wartości: 128 kbps (mono/radio), 192–320 kbps (stereo TV).'],
                ['statmux_weight', 'Waga StatMux (0-100)', 'number', undefined, 'Priorytet alokacji przepływności w puli StatMux. Wyższy = kanał dostaje więcej bitrate przy dużym ruchu (np. kanały sportowe mają wyższe wagi).'],
                ['statmux_min_mbps', 'Min bitrate (Mbps)', 'number', undefined, 'Minimalne gwarantowane pasmo w Mbit/s, którego StatMux nigdy nie odebrał temu kanałowi.'],
                ['statmux_max_mbps', 'Max bitrate (Mbps)', 'number', undefined, 'Górny limit pasma w Mbit/s, jaki kanał może zająć z puli StatMux (np. przy statycznych scenach).'],
                ['hbbtv_enabled', 'HbbTV', 'select', ['0', '1'], 'Hybrid Broadcast Broadband TV — interaktywna nakładka (czerwony przycisk, catch-up TV). Wymaga URL aplikacji AIT i łącza broadband u widza.'],
                ['teletext_enabled', 'Teletext', 'select', ['0', '1'], 'Transmisja stron teletekstu w strumieniu TS. Wpisywane w PMT jako strumień prywatny (typ 0x06). Wymaga dosyłu VBI od nadawcy.'],
                ['ssu_enabled', 'SSU', 'select', ['0', '1'], 'System Software Update — mechanizm OTA aktualizacji oprogramowania dekoderów przez strumień TS (wg ETSI TR 101 202).'],
                ['status', 'Status', 'select', ['active', 'inactive', 'error']],
              ] as [keyof Channel, string, string, string[]?, string?][]).map(([key, label, type, opts, hint]) => (
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
                <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                  URL HbbTV <FieldHint text="URL aplikacji HbbTV (https://...). Wpisywany do tablicy AIT jako punkt wejścia aplikacji interaktywnej (czerwony przycisk, catch-up)." />
                </label>
                <input type="text" value={editing.hbbtv_url ?? ''} onChange={e => f('hbbtv_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* IPTV section */}
              <div className={`col-span-2 border-t border-gray-100 pt-4 mt-2 ${isIptv ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Wifi size={14} className="text-indigo-500" />
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ustawienia IPTV / Strumień</span>
                  {!isIptv && <span className="text-xs text-gray-400">(dostępne tylko dla multipleksów IPTV)</span>}
                </div>
                <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs text-indigo-900">
                  <p className="font-semibold">Szybki test lokalnego IPTV</p>
                  <p className="mt-1 text-indigo-800">
                    Uruchom serwer testowy z folderu <span className="font-mono">tools/demo-server</span> poleceniem <span className="font-mono">pnpm install</span> i potem <span className="font-mono">pnpm start</span>
                    albo z root projektu <span className="font-mono">pnpm iptv:demo-server</span>. Skopiuj adres HLS pokazany w konsoli lub na stronie pomocy, wklej go do pola poniżej,
                    ustaw protokół <span className="font-mono">HLS</span>, zapisz kanał i sprawdź podgląd w emulatorze przyciskiem <span className="font-mono">OK</span>.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      Adres strumienia <FieldHint text="Pełny URL strumienia dostarczanego przez nadawcę lub koder. Obsługiwane protokoły: HLS (https://), RTMP (rtmp://), SRT (srt://), UDP (udp://@adres:port)." />
                    </label>
                    <input type="text" value={editing.stream_url ?? ''} onChange={e => f('stream_url', e.target.value)}
                      placeholder="https://... lub rtmp://... lub srt://..."
                      disabled={!isIptv}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      Protokół strumienia <FieldHint text="Wybierz protokół odpowiadający URL strumienia. Wpływa na ikonę w tabeli i sposób przetwarzania przez odtwarzacz." />
                    </label>
                    <select value={editing.stream_type ?? 'hls'} onChange={e => f('stream_type', e.target.value)}
                      disabled={!isIptv}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50">
                      <option value="hls">HLS</option>
                      <option value="rtmp">RTMP</option>
                      <option value="srt">SRT</option>
                      <option value="dash">DASH</option>
                      <option value="udp">UDP</option>
                      <option value="rist">RIST</option>
                      <option value="icecast">Icecast / Shoutcast</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      ID kanału w źródle EPG <FieldHint text="Identyfikator kanału w zewnętrznym pliku XMLTV (np. 'tvp1.pl', 'polsat.pl'). Musi odpowiadać atrybutowi id elementu channel w pliku EPG." />
                    </label>
                    <input type="text" value={editing.epg_channel_id ?? ''} onChange={e => f('epg_channel_id', e.target.value)}
                      placeholder="np. tvp1.pl"
                      disabled={!isIptv}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50" />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      URL źródła EPG (XMLTV) <FieldHint text="URL do pliku EPG w formacie XMLTV z danymi programowymi dla tego kanału. Plik musi zawierać element channel z pasującym id." />
                    </label>
                    <input type="text" value={editing.epg_source_url ?? ''} onChange={e => f('epg_source_url', e.target.value)}
                      placeholder="https://epg.example.com/xmltv.xml"
                      disabled={!isIptv}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50" />
                  </div>
                </div>
              </div>

              {/* Radio section */}
              <div className={`col-span-2 border-t border-gray-100 pt-4 mt-2 ${isRadio ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Music size={14} className="text-teal-500" />
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ustawienia kanału radiowego</span>
                  {!isRadio && <span className="text-xs text-gray-400">(dostępne gdy typ = Radio)</span>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Typ kanału</label>
                    <select value={editing.channel_type ?? 'tv'} onChange={e => f('channel_type', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                      <option value="tv">📺 TV (telewizja)</option>
                      <option value="radio">📻 Radio</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      Kodek audio <FieldHint text="Kodek kompresji audio. MP2 = tradycyjny dla DVB (wymagany przez niektóre odbiorniki). AAC/HE-AAC = nowoczesne, wydajniejsze kodeki stosowane w DVB-T2." />
                    </label>
                    <select value={editing.audio_codec ?? 'AAC'} onChange={e => f('audio_codec', e.target.value)}
                      disabled={!isRadio}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50">
                      <option value="MP2">MPEG-1 Layer II (MP2)</option>
                      <option value="MP3">MPEG-1 Layer III (MP3)</option>
                      <option value="AAC">AAC-LC</option>
                      <option value="HE-AAC">HE-AAC (AAC+)</option>
                      <option value="HE-AACv2">HE-AACv2 (eAAC+)</option>
                      <option value="Opus">Opus</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      Częstotliwość próbkowania (Hz) <FieldHint text="Liczba próbek audio na sekundę. 48 000 Hz = standard broadcast (zalecane). 44 100 Hz = standard CD." />
                    </label>
                    <select value={String(editing.sample_rate_hz ?? 48000)} onChange={e => f('sample_rate_hz', Number(e.target.value))}
                      disabled={!isRadio}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50">
                      <option value="44100">44 100 Hz (CD)</option>
                      <option value="48000">48 000 Hz (broadcast)</option>
                      <option value="32000">32 000 Hz</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                      Tryb stereo <FieldHint text="Sposób kodowania kanałów stereo. Joint Stereo = wydajniejszy od stereo. Dual Mono = dwa niezależne kanały mono (np. różne języki). Mono = jeden kanał." />
                    </label>
                    <select value={editing.stereo_mode ?? 'stereo'} onChange={e => f('stereo_mode', e.target.value)}
                      disabled={!isRadio}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50">
                      <option value="stereo">Stereo</option>
                      <option value="joint_stereo">Joint Stereo</option>
                      <option value="mono">Mono</option>
                      <option value="dual_mono">Dual Mono</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zapisz</button>
            </div>
          </Modal>
    </div>
  );
}

