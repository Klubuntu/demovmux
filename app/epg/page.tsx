'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { CalendarDays, Clock, Plus, Pencil, Trash2, Wifi, Tv2 } from 'lucide-react';

interface Channel {
  id: number;
  name: string;
  short_name: string;
  mux_name: string;
  mux_type: string;
  stream_type: string | null;
  stream_url: string | null;
}

interface Program {
  id: number;
  channel_id: number;
  channel_name: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  category: string | null;
  language: string;
  episode_num: string | null;
  rating: string | null;
}

const emptyProg = {
  id: 0,
  channel_id: 0,
  title: '',
  description: '',
  start_at: '',
  end_at: '',
  category: '',
  language: 'pl',
  episode_num: '',
  rating: '',
};

type ProgForm = typeof emptyProg;

const CATEGORIES = ['Aktualności', 'Rozrywka', 'Film fabularny', 'Serial', 'Dokumentalny', 'Przyrodniczy', 'Sport', 'Tenis', 'Kolarstwo', 'Skoki narciarskie', 'Snooker', 'Padel', 'Lekkoatletyka', 'Muzyka', 'Kulinarny', 'Reality Show', 'Talk Show', 'Publicystyka', 'Nauka', 'Historia', 'Podróże', 'Business', 'News', 'Technology', 'Dla dzieci'];

function toLocalInput(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(val: string) {
  if (!val) return '';
  return new Date(val).toISOString();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function todayString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const STREAM_TYPE_COLORS: Record<string, string> = {
  hls: 'bg-blue-100 text-blue-700',
  rtmp: 'bg-orange-100 text-orange-700',
  srt: 'bg-purple-100 text-purple-700',
  dash: 'bg-green-100 text-green-700',
  udp: 'bg-gray-100 text-gray-700',
  rist: 'bg-pink-100 text-pink-700',
};

export default function EpgPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProgForm>(emptyProg);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/channels')
      .then(r => r.json())
      .then((data: Channel[]) => {
        setChannels(data);
        if (data.length > 0) setSelectedChannelId(data[0].id);
      });
  }, []);

  const loadPrograms = useCallback(async () => {
    if (!selectedChannelId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/epg?channel_id=${selectedChannelId}&date=${selectedDate}`);
      const data = await res.json();
      setPrograms(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [selectedChannelId, selectedDate]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  function openAdd() {
    const base = new Date(`${selectedDate}T08:00`).toISOString();
    const baseEnd = new Date(`${selectedDate}T09:00`).toISOString();
    setEditing({ ...emptyProg, channel_id: selectedChannelId ?? 0, start_at: toLocalInput(base), end_at: toLocalInput(baseEnd) });
    setShowModal(true);
  }

  function openEdit(p: Program) {
    setEditing({
      id: p.id,
      channel_id: p.channel_id,
      title: p.title,
      description: p.description ?? '',
      start_at: toLocalInput(p.start_at),
      end_at: toLocalInput(p.end_at),
      category: p.category ?? '',
      language: p.language,
      episode_num: p.episode_num ?? '',
      rating: p.rating ?? '',
    });
    setShowModal(true);
  }

  async function saveProgram() {
    const payload = {
      ...editing,
      channel_id: editing.id ? editing.channel_id : selectedChannelId,
      start_at: fromLocalInput(editing.start_at),
      end_at: fromLocalInput(editing.end_at),
    };
    if (editing.id) {
      await fetch(`/api/epg/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/epg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowModal(false);
    loadPrograms();
  }

  async function deleteProgram(id: number) {
    if (!confirm('Usunąć program EPG?')) return;
    await fetch(`/api/epg/${id}`, { method: 'DELETE' });
    loadPrograms();
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6">
          {/* Title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                <CalendarDays size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">EPG – Przewodnik programowy</h1>
                <p className="text-sm text-gray-500">Zarządzanie schedułem programów per kanał</p>
              </div>
            </div>
            <button
              onClick={openAdd}
              disabled={!selectedChannelId}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
              Dodaj program
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-500 mb-1">Kanał</label>
              <select
                value={selectedChannelId ?? ''}
                onChange={e => setSelectedChannelId(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mux_name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            {selectedChannel && (
              <div className="flex items-center gap-2 text-sm text-gray-500 border-l border-gray-200 pl-4">
                {selectedChannel.mux_type === 'iptv' ? (
                  <>
                    <Wifi size={14} className="text-indigo-500" />
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STREAM_TYPE_COLORS[selectedChannel.stream_type ?? 'hls'] ?? 'bg-gray-100 text-gray-700'}`}>
                      {(selectedChannel.stream_type ?? 'HLS').toUpperCase()}
                    </span>
                    <span className="font-mono text-xs truncate max-w-xs">{selectedChannel.stream_url}</span>
                  </>
                ) : (
                  <>
                    <Tv2 size={14} className="text-blue-500" />
                    <span className="text-xs">DVB · {selectedChannel.mux_name}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Programs list */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">
                {programs.length > 0 ? `${programs.length} programów – ${selectedDate}` : `Brak programów – ${selectedDate}`}
              </h2>
              {loading && <span className="text-xs text-gray-400 animate-pulse">Ładowanie…</span>}
            </div>

            {programs.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <CalendarDays size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Brak danych EPG dla wybranego kanału i daty</p>
                <button onClick={openAdd} className="mt-3 text-indigo-600 text-sm hover:underline">+ Dodaj pierwszy program</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {programs.map(p => (
                  <div key={p.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50 group transition-colors">
                    {/* Time column */}
                    <div className="w-20 flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-800 font-mono">{formatTime(p.start_at)}</p>
                      <p className="text-xs text-gray-400 font-mono">{formatTime(p.end_at)}</p>
                    </div>

                    {/* Duration bar */}
                    <div className="flex flex-col items-center flex-shrink-0 w-3 pt-1">
                      <div className="w-2 h-2 rounded-full bg-indigo-400" />
                      <div className="w-0.5 flex-1 bg-indigo-100 my-0.5 min-h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900">{p.title}</span>
                        {p.episode_num && (
                          <span className="text-xs text-gray-400">({p.episode_num})</span>
                        )}
                        {p.rating && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{p.rating}</span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-1">{p.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDuration(p.start_at, p.end_at)}
                        </span>
                        {p.category && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.category}</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${p.language === 'pl' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{p.language.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Edytuj"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteProgram(p.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Usuń"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing.id ? 'Edytuj program EPG' : 'Nowy program EPG'}
        size="lg"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tytuł *</label>
            <input
              type="text"
              value={editing.title}
              onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="np. Wiadomości"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Początek *</label>
              <input
                type="datetime-local"
                value={editing.start_at}
                onChange={e => setEditing(p => ({ ...p, start_at: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Koniec *</label>
              <input
                type="datetime-local"
                value={editing.end_at}
                onChange={e => setEditing(p => ({ ...p, end_at: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategoria</label>
              <select
                value={editing.category}
                onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— wybierz —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Język</label>
              <select
                value={editing.language}
                onChange={e => setEditing(p => ({ ...p, language: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="pl">Polski (pl)</option>
                <option value="en">English (en)</option>
                <option value="de">Deutsch (de)</option>
                <option value="fr">Français (fr)</option>
                <option value="uk">Українська (uk)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Opis</label>
            <textarea
              value={editing.description}
              onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder="Krótki opis programu…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nr odcinka</label>
              <input
                type="text"
                value={editing.episode_num}
                onChange={e => setEditing(p => ({ ...p, episode_num: e.target.value }))}
                placeholder="np. S01E03"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Klasyfikacja</label>
              <input
                type="text"
                value={editing.rating}
                onChange={e => setEditing(p => ({ ...p, rating: e.target.value }))}
                placeholder="np. 12+, 18+"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
            <button onClick={saveProgram} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{editing.id ? 'Zapisz' : 'Dodaj'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
