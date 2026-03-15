'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import {
  HelpCircle, X, Power, Volume2, VolumeX, Info, Home,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Wifi, Satellite, Radio, Signal, Cpu, Database, Maximize2, Minimize2, AlertTriangle,
} from 'lucide-react';

// ─────────────────────────── types ───────────────────────────
interface Channel {
  id: number; name: string; lcn: number; mux_name: string; mux_id: number;
  mux_type: string; video_format: string; channel_type: string; status: string;
  teletext_enabled?: number;
  stream_type?: string | null; stream_url?: string | null;
}
interface Multiplex {
  id: number; name: string; number: number; standard: string;
  mux_type: string; status: string; channel_count: number;
  frequency_mhz?: number;
}
interface SysInfo {
  dbType: string;
  counts: { multiplexes: number; channels: number; sfnNodes: number; streams: number; events: number };
}
type ReceptionType = 'dvbt2' | 'dvbs2' | 'dvbc' | 'iptv';
interface CtxMenu { x: number; y: number; }

// ─────────────────────────── constants ───────────────────────────
const REC_TO_MUX: Record<ReceptionType, string> = {
  dvbt2: 'terrestrial',
  dvbs2: 'satellite',
  dvbc:  'cable',
  iptv:  'iptv',
};

const RECEPTION: Record<ReceptionType, {
  label: string; color: string; ring: string; bg: string; Icon: React.ElementType;
}> = {
  dvbt2: { label: 'DVB-T2', color: 'text-blue-400',   ring: 'ring-blue-500',   bg: 'bg-blue-900/50',   Icon: Signal },
  dvbs2: { label: 'DVB-S2', color: 'text-purple-400', ring: 'ring-purple-500', bg: 'bg-purple-900/50', Icon: Satellite },
  dvbc:  { label: 'DVB-C',  color: 'text-green-400',  ring: 'ring-green-500',  bg: 'bg-green-900/50',  Icon: Radio },
  iptv:  { label: 'IPTV',   color: 'text-indigo-400', ring: 'ring-indigo-500', bg: 'bg-indigo-900/50', Icon: Wifi },
};

const SHORTCUTS = [
  { key: '↑ / ↓',          desc: 'Kanał wyżej / niżej' },
  { key: '← / →',          desc: 'Głośność -/+' },
  { key: 'Enter',           desc: 'OK / Potwierdź' },
  { key: '0–9',             desc: 'Wpisz numer kanału' },
  { key: 'I',               desc: 'Informacje o kanale' },
  { key: 'M',               desc: 'Menu główne' },
  { key: 'T',               desc: 'Zmień typ odbioru' },
  { key: 'P',               desc: 'Włącz / Wyłącz (Power)' },
  { key: 'Esc / Backspace', desc: 'Wstecz / Zamknij' },
  { key: 'H / F1',          desc: 'Pomoc' },
];

const MENU_ITEMS = [
  'Lista kanałów', 'Ustawienia obrazu', 'Ustawienia dźwięku',
  'Tryb odbioru', 'Informacje o systemie',
];

const PREVIEW_STREAM_TYPES = new Set(['hls', 'rtmp', 'srt', 'dash', 'mld']);

// ─────────────────────────── component ───────────────────────────
export default function EmulatorPage() {
  const [progress, setProgress] = useState(0);
  const [booted, setBooted]     = useState(false);

  const [powered, setPowered]         = useState(false);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [channels, setChannels]       = useState<Channel[]>([]);
  const [multiplexes, setMultiplexes] = useState<Multiplex[]>([]);
  const [sysInfo, setSysInfo]         = useState<SysInfo | null>(null);
  const [chIdx, setChIdx]             = useState(0);
  const [volume, setVolume]           = useState(60);
  const [muted, setMuted]             = useState(false);
  const [reception, setReception]     = useState<ReceptionType>('dvbt2');
  const [switching, setSwitching]     = useState(false);

  const [showHelp, setShowHelp]       = useState(false);
  const [showInfo, setShowInfo]       = useState(false);
  const [showMenu, setShowMenu]       = useState(false);
  const [showSysInfo, setShowSysInfo] = useState(false);
  const [menuIdx, setMenuIdx]         = useState(0);
  const [ctxMenu, setCtxMenu]         = useState<CtxMenu | null>(null);
  const [pendingMuxJump, setPendingMuxJump] = useState<number | null>(null);
  const [pendingChannelId, setPendingChannelId] = useState<number | null>(null);
  const [previewArmed, setPreviewArmed] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [reachability, setReachability] = useState<Record<number, boolean>>({});

  const [osd, setOsd]       = useState<{ msg: string; vol: boolean } | null>(null);
  const [numBuf, setNumBuf] = useState('');
  const osdTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const radioRef = useRef<HTMLAudioElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const lastSelectedChannelKey = useRef<string>('');

  // boot
  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(t); setTimeout(() => { setBooted(true); setPowered(true); }, 500); return 100; }
        return p + 1.6;
      });
    }, 25);
    return () => clearInterval(t);
  }, []);

  // data
  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetch('/api/channels').then(r => r.json())
        .then((d: Channel[]) => {
          if (mounted) setAllChannels(d.filter(c => c.status === 'active'));
        });
      fetch('/api/multiplexes').then(r => r.json()).then(d => { if (mounted) setMultiplexes(d); });
      fetch('/api/settings').then(r => r.json()).then(d => { if (mounted) setSysInfo(d); }).catch(() => null);
    };
    load();
    const interval = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // filter channels when reception or allChannels changes, zachowaj wybrany kanał
  useEffect(() => {
    const muxType = REC_TO_MUX[reception];
    const filtered = allChannels.filter(c => c.mux_type === muxType);
    setChannels(filtered);
    // zachowaj wybrany kanał jeśli istnieje
    if (filtered.length === 0) {
      setChIdx(0);
    } else if (channels.length > 0 && filtered.some(c => c.id === channels[chIdx]?.id)) {
      // wybrany kanał nadal istnieje
      setChIdx(filtered.findIndex(c => c.id === channels[chIdx]?.id));
    } else {
      setChIdx(0);
    }
    // obsługa pendingChannelId (np. wybór numeru kanału z innego typu odbioru)
    if (pendingChannelId !== null) {
      const idx = filtered.findIndex(c => c.id === pendingChannelId);
      if (idx >= 0) {
        setSwitching(true);
        setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
      } else {
        setChIdx(0);
      }
      setPendingChannelId(null);
      setPendingMuxJump(null);
      return;
    }
    // obsługa pendingMuxJump
    if (pendingMuxJump !== null) {
      const idx = filtered.findIndex(c => c.mux_id === pendingMuxJump);
      if (idx >= 0) {
        setSwitching(true);
        setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
      } else {
        setChIdx(0);
      }
      setPendingMuxJump(null);
    }
  }, [reception, allChannels, pendingChannelId, pendingMuxJump]);
  // obsługa długiego OK (longPress)
  const [showChannelList, setShowChannelList] = useState(false);
  const [channelListIdx, setChannelListIdx] = useState(0);
  const okButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        longPress.current = setTimeout(() => {
          setShowChannelList(true);
        }, 600);
      }
      // żółty przycisk (F2)
      if (e.key === 'F2') {
        setShowChannelList(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (longPress.current) {
          clearTimeout(longPress.current);
          longPress.current = null;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  // zamknij listę kanałów ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowChannelList(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (showChannelList) setChannelListIdx(chIdx);
  }, [showChannelList, chIdx]);

  useEffect(() => {
    if (channels.length === 0) {
      setChannelListIdx(0);
      return;
    }
    setChannelListIdx(i => Math.min(Math.max(i, 0), channels.length - 1));
  }, [channels.length]);
  // komponent pełnoekranowej listy kanałów
  const ChannelListOverlay = (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">Lista kanałów ({channels.length})</h2>
        <button onClick={() => setShowChannelList(false)} className="text-white text-2xl">×</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="bg-gray-800">
              <th className="px-4 py-2 text-left">Nr</th>
              <th className="px-4 py-2 text-left">Nazwa</th>
              <th className="px-4 py-2 text-left">Częstotliwość</th>
              <th className="px-4 py-2 text-left">MUX</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => selectChannelFromList(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectChannelFromList(i);
                  }
                }}
                tabIndex={0}
                className={`${i === channelListIdx ? 'bg-indigo-700' : 'bg-gray-900'} cursor-pointer hover:bg-indigo-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-400/70`}
              >
                <td className="px-4 py-2 font-mono">{c.lcn}</td>
                <td className="px-4 py-2">{c.name}{c.stream_url && reachability[c.id] === false && <span title="Kanał tymczasowo niedostępny"><AlertTriangle size={11} className="inline ml-1 text-yellow-500"/></span>}</td>
                <td className="px-4 py-2">{multiplexes.find(m => m.id === c.mux_id)?.frequency_mhz ?? '-'}</td>
                <td className="px-4 py-2">{c.mux_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const flashOsd = useCallback((msg: string, vol = false) => {
    setOsd({ msg, vol });
    if (osdTimer.current) clearTimeout(osdTimer.current);
    osdTimer.current = setTimeout(() => setOsd(null), 2500);
  }, []);

  const probeReachable = useCallback(async (channel?: Channel | null) => {
    if (!channel?.stream_url) return false;
    const streamType = (channel.stream_type ?? '').toLowerCase();
    if (!['hls', 'dash', 'mld', 'icecast'].includes(streamType)) return false;
    if (!/^https?:\/\//i.test(channel.stream_url)) return false;
    try {
      await fetch(channel.stream_url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(4500),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const isPreviewEligible = useCallback((channel?: Channel | null) => {
    if (!channel || channel.channel_type === 'radio') return false;
    if (!channel.stream_url) return false;
    return PREVIEW_STREAM_TYPES.has((channel.stream_type ?? '').toLowerCase());
  }, []);

  const resetPreview = useCallback((channel?: Channel | null) => {
    const eligible = isPreviewEligible(channel);
    setPreviewActive(false);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewArmed(eligible);
  }, [isPreviewEligible]);

  const chUp = useCallback(() => {
    if (!powered || channels.length === 0) return;
    setSwitching(true);
    setTimeout(() => { setChIdx(i => (i + 1) % channels.length); setSwitching(false); }, 200);
  }, [powered, channels]);

  const chDown = useCallback(() => {
    if (!powered || channels.length === 0) return;
    setSwitching(true);
    setTimeout(() => { setChIdx(i => (i - 1 + channels.length) % channels.length); setSwitching(false); }, 200);
  }, [powered, channels]);

  const volUp   = useCallback(() => { if (!powered) return; setMuted(false); setVolume(v => Math.min(100, v + 5)); flashOsd('', true); }, [powered, flashOsd]);
  const volDown = useCallback(() => { if (!powered) return; setVolume(v => Math.max(0, v - 5)); flashOsd('', true); }, [powered, flashOsd]);

  const toggleMute = useCallback(() => {
    if (!powered) return;
    setMuted(m => { flashOsd(m ? 'Dźwięk włączony' : 'Wyciszono'); return !m; });
  }, [powered, flashOsd]);

  const cycleReception = useCallback(() => {
    const keys = Object.keys(RECEPTION) as ReceptionType[];
    setReception(cur => {
      const next = keys[(keys.indexOf(cur) + 1) % keys.length];
      flashOsd(`Tryb odbioru: ${RECEPTION[next].label}`);
      return next;
    });
  }, [flashOsd]);

  const commitNumericZap = useCallback((forcedBuf?: string) => {
    if (!powered) return false;
    const buf = (forcedBuf ?? numBuf).trim();
    if (!buf) return false;
    if (numTimer.current) {
      clearTimeout(numTimer.current);
      numTimer.current = null;
    }

    const lcn = Number.parseInt(buf, 10);
    if (!Number.isFinite(lcn)) {
      setNumBuf('');
      return false;
    }

    const currentMatch = channels.find(c => c.lcn === lcn);
    if (currentMatch) {
      const idx = channels.findIndex(c => c.id === currentMatch.id);
      setSwitching(true);
      setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
      flashOsd(`Kanał ${lcn}: ${currentMatch.name}`);
      setNumBuf('');
      return true;
    }

    const globalMatch = allChannels.find(c => c.lcn === lcn);
    if (!globalMatch) {
      flashOsd(`Kanał ${lcn} niedostępny`);
      setNumBuf('');
      return false;
    }

    const targetReception = (Object.entries(REC_TO_MUX).find(([, muxType]) => muxType === globalMatch.mux_type)?.[0] ?? null) as ReceptionType | null;
    flashOsd(`Kanał ${lcn}: ${globalMatch.name}`);
    setNumBuf('');

    if (targetReception && targetReception !== reception) {
      setPendingChannelId(globalMatch.id);
      setReception(targetReception);
      return true;
    }

    const idx = channels.findIndex(c => c.id === globalMatch.id);
    if (idx >= 0) {
      setSwitching(true);
      setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
      return true;
    }

    setPendingChannelId(globalMatch.id);
    return true;
  }, [powered, numBuf, channels, allChannels, reception, flashOsd]);

  const pressNum = useCallback((n: string) => {
    if (!powered) return;
    const buf = (numBuf + n).slice(-3);
    setNumBuf(buf);
    flashOsd(`Kanał: ${buf}`);
    if (numTimer.current) clearTimeout(numTimer.current);
    numTimer.current = setTimeout(() => {
      commitNumericZap(buf);
    }, 1500);
  }, [powered, numBuf, flashOsd, commitNumericZap]);

  const activatePreview = useCallback(() => {
    const currentChannel = channels[chIdx];
    if (!powered || !currentChannel) return;
    if (previewActive || previewLoading) {
      flashOsd('Podgląd kanału już aktywny');
      return;
    }
    if (!isPreviewEligible(currentChannel)) {
      flashOsd('Brak podglądu dla tego kanału');
      return;
    }
    setPreviewArmed(false);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewActive(true);
    flashOsd(`Ładowanie podglądu: ${currentChannel.name}`);
  }, [channels, chIdx, powered, previewActive, previewLoading, isPreviewEligible, flashOsd]);

  const notifyReceptionLocked = useCallback(() => {
    flashOsd('Tryb odbioru nie zmienia się z pilota. Użyj menu MUX (PPM).');
  }, [flashOsd]);

  const jumpToMux = useCallback((muxId: number, recType: ReceptionType) => {
    const mux = multiplexes.find(m => m.id === muxId);
    setCtxMenu(null);
    flashOsd(`MUX: ${mux?.name ?? '–'}`);
    if (!powered) return;
    if (recType !== reception) {
      // switch reception first; useEffect will handle the channel jump via pendingMuxJump
      setReception(recType);
      setPendingMuxJump(muxId);
    } else {
      const idx = channels.findIndex(c => c.mux_id === muxId);
      if (idx >= 0) {
        setSwitching(true);
        setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
      }
    }
  }, [channels, multiplexes, powered, reception, flashOsd]);

  // long-press / context-menu handlers for the top bar
  const openCtxMenu = useCallback((x: number, y: number) => {
    setCtxMenu({ x, y });
  }, []);

  const handleTitleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY);
  }, [openCtxMenu]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPress.current = setTimeout(() => {
      openCtxMenu(touch.clientX, touch.clientY);
    }, 600);
  }, [openCtxMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
  }, []);

  const handleMenuSelect = useCallback((item: string, idx: number) => {
    setMenuIdx(idx);
    setShowMenu(false);
    if (item === 'Informacje o systemie') setShowSysInfo(true);
    else flashOsd(item);
  }, [flashOsd]);

  const ch  = channels[chIdx];
  const rec = RECEPTION[reception];
  const sig = 72 + ((chIdx * 7 + 13) % 22);
  const previewEligible = isPreviewEligible(ch);
  const selectedChannelKey = ch ? `${ch.id}|${ch.stream_type ?? ''}|${ch.stream_url ?? ''}|${ch.channel_type ?? ''}` : 'none';
  const currentReachable = ch ? Boolean(reachability[ch.id]) : false;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const rows = await Promise.all(channels.map(async (c) => [c.id, await probeReachable(c)] as const));
      if (cancelled) return;
      setReachability(Object.fromEntries(rows));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [channels, probeReachable]);

  useEffect(() => {
    const audio = radioRef.current;
    if (!audio) return;
    if (!powered || !ch || ch.channel_type !== 'radio' || switching) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setRadioLoading(false);
      setRadioError(null);
      return;
    }

    let cancelled = false;
    const openRadio = async () => {
      setRadioLoading(true);
      setRadioError(null);
      const ok = await probeReachable(ch);
      if (cancelled) return;
      setReachability(prev => ({ ...prev, [ch.id]: ok }));
      if (!ok || !ch.stream_url) {
        setRadioLoading(false);
        setRadioError('Kanał tymczasowo niedostępny');
        return;
      }
      audio.src = ch.stream_url;
      audio.muted = muted;
      audio.volume = muted ? 0 : volume / 100;
      try {
        await audio.play();
        if (!cancelled) {
          setRadioLoading(false);
          setRadioError(null);
        }
      } catch {
        if (!cancelled) {
          setRadioLoading(false);
          setRadioError('Nie udało się uruchomić stacji radiowej');
        }
      }
    };
    void openRadio();

    return () => {
      cancelled = true;
      audio.pause();
    };
  }, [powered, ch?.id, ch?.channel_type, ch?.stream_url, switching, muted, volume, probeReachable]);

  const openChannelList = useCallback(() => {
    if (!powered) return;
    setShowChannelList(true);
    setChannelListIdx(chIdx);
  }, [powered, chIdx]);

  const selectChannelFromList = useCallback((idx: number) => {
    if (!powered) return;
    const target = channels[idx];
    if (!target) return;
    setShowChannelList(false);
    if (idx === chIdx) return;
    setSwitching(true);
    setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
  }, [powered, channels, chIdx]);

  const openTeletext = useCallback(() => {
    if (!powered || !ch) return;
    if (ch.channel_type === 'radio' || !ch.teletext_enabled) {
      flashOsd('Teletext niedostępny');
      return;
    }
    flashOsd('Teletext');
  }, [powered, ch, flashOsd]);

  const togglePreviewFullscreen = useCallback(async () => {
    if (!previewActive || !ch?.stream_url) return;
    const target = previewViewportRef.current ?? previewRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      flashOsd('Fullscreen niedostępny');
    }
  }, [previewActive, ch?.stream_url, flashOsd]);

  useEffect(() => {
    const onFsChange = () => setPreviewFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (selectedChannelKey === lastSelectedChannelKey.current) return;
    lastSelectedChannelKey.current = selectedChannelKey;
    resetPreview(channels[chIdx]);
  }, [selectedChannelKey, channels, chIdx, resetPreview]);

  useEffect(() => {
    if (!powered) resetPreview(null);
  }, [powered, resetPreview]);

  useEffect(() => {
    if (!previewActive || !ch?.stream_url || !previewRef.current) return;

    const video = previewRef.current;
    const streamUrl = ch.stream_url;
    const streamType = (ch.stream_type ?? '').toLowerCase();
    let hls: Hls | null = null;
    let cancelled = false;
    let settled = false;
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

    video.pause();
    video.removeAttribute('src');
    video.load();
    video.muted = muted;
    video.volume = muted ? 0 : volume / 100;

    const markLoaded = () => {
      if (settled) return;
      settled = true;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      if (!cancelled) {
        setPreviewLoading(false);
        setPreviewError(null);
      }
    };

    const markError = () => {
      if (settled) return;
      settled = true;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      if (!cancelled) {
        setPreviewLoading(false);
        setPreviewError('Nie udało się załadować podglądu kanału');
      }
    };

    loadingTimeout = setTimeout(() => {
      markError();
    }, 12000);

    const tryPlay = async () => {
      try {
        await video.play();
        markLoaded();
      } catch {
        markError();
      }
    };

    const onLoadedData = () => {
      void tryPlay();
    };
    const onError = () => {
      markError();
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('error', onError);

    if (streamType === 'hls' && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, enableWorker: true });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void tryPlay();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) markError();
      });
    } else {
      video.src = streamUrl;
      void tryPlay();
    }

    return () => {
      cancelled = true;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
      video.pause();
      if (hls) hls.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [previewActive, ch?.id, ch?.stream_url, ch?.stream_type]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = muted ? 0 : volume / 100;
  }, [muted, volume]);

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (showChannelList) setChannelListIdx(i => Math.max(0, i - 1));
          else if (showMenu) setMenuIdx(i => Math.max(0, i - 1));
          else chUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (showChannelList) setChannelListIdx(i => Math.min(channels.length - 1, i + 1));
          else if (showMenu) setMenuIdx(i => Math.min(MENU_ITEMS.length - 1, i + 1));
          else chDown();
          break;
        case 'ArrowLeft':  e.preventDefault(); volDown(); break;
        case 'ArrowRight': e.preventDefault(); volUp();   break;
        case 'Enter':
          e.preventDefault();
          if (showChannelList) selectChannelFromList(channelListIdx);
          else if (showMenu) handleMenuSelect(MENU_ITEMS[menuIdx], menuIdx);
          else if (numBuf) commitNumericZap();
          else activatePreview();
          break;
        case 'Escape': case 'Backspace':
          setShowChannelList(false); setShowMenu(false); setShowInfo(false); setShowHelp(false); setShowSysInfo(false); setCtxMenu(null); break;
        case 'i': case 'I': if (powered) setShowInfo(v => !v); break;
        case 'm': case 'M': if (powered) setShowMenu(v => !v); break;
        case 't': case 'T': cycleReception(); break;
        case 'p': case 'P': setPowered(v => !v); break;
        case 'h': case 'H': case 'F1': e.preventDefault(); setShowHelp(v => !v); break;
        default: if (/^[0-9]$/.test(e.key)) pressNum(e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [chUp, chDown, volUp, volDown, cycleReception, pressNum, powered, showMenu, menuIdx, handleMenuSelect, numBuf, commitNumericZap, activatePreview, showChannelList, channelListIdx, channels.length, selectChannelFromList]);

  // ══ BOOT ══
  if (!booted) return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-50 select-none">
      <div className="flex flex-col items-center gap-7 text-center px-6">
        <div className="flex items-end gap-1 h-14">
          {[2,4,6,9,12,9,6,4,2].map((h,i) => (
            <div key={i} className="w-2.5 rounded-sm transition-all duration-300"
              style={{ height:`${h*5}px`, background: progress>i*11?`hsl(${210+i*6},80%,55%)`:'#1f2937' }}/>
          ))}
        </div>
        <div>
          <p className="text-white text-3xl font-bold tracking-widest">vMUX</p>
          <p className="text-blue-400 text-sm tracking-[0.3em] uppercase mt-1">Emulator</p>
          <p className="text-gray-600 text-xs mt-1">Wirtualny dekoder DVB / IPTV</p>
        </div>
        <div className="w-72 space-y-2">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-75" style={{width:`${progress}%`}}/>
          </div>
          <p className="text-gray-600 text-xs font-mono">
            {progress<30?'Inicjalizacja sprzętu…':progress<60?'Ładowanie modułów DVB…':progress<85?'Skanowanie kanałów…':progress<99?'Uruchamianie GUI…':'Gotowy.'}
            <span className="ml-2 text-gray-700">{Math.floor(progress)}%</span>
          </p>
        </div>
      </div>
    </div>
  );

  // ══ MAIN ══
  return (
    <div className="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl min-h-[calc(100vh-7rem)]">
      {showChannelList && ChannelListOverlay}
      <audio ref={radioRef} className="hidden" playsInline />

      {/* top bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 gap-3"
        onContextMenu={handleTitleRightClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-white font-bold text-sm shrink-0 select-none"
            title="PPM / przytrzymaj → lista wszystkich multipleksów"
          >
            vMUX Emulator
          </span>
          <button
            onClick={notifyReceptionLocked}
            onContextMenu={e => { e.stopPropagation(); e.preventDefault(); openCtxMenu(e.clientX, e.clientY); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-current/30 transition-all hover:opacity-80 active:scale-95 shrink-0 ${rec.bg} ${rec.color}`}
            title="LPM: info | PPM: lista MUX-ów"
          >
            <rec.Icon size={11}/>{rec.label}
          </button>
          {powered && ch && (
            <span className="text-gray-500 text-xs truncate hidden sm:block">
              {String(ch.lcn).padStart(3,'0')} · {ch.name}
            </span>
          )}
        </div>
        <button onClick={() => setShowHelp(true)}
          onContextMenu={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800 shrink-0">
          <HelpCircle size={13}/>Pomoc
        </button>
      </div>

      {/* context menu – ALL muxes grouped by type, with backdrop to close */}
      {ctxMenu && (
        <>
          {/* backdrop – catches any click outside the menu */}
          <div
            className="fixed inset-0 z-[199]"
            onClick={() => setCtxMenu(null)}
            onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }}
          />
          <div
            className="fixed z-[200] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto min-w-60"
            style={{ left: ctxMenu?.x ?? 0, top: ctxMenu?.y ?? 0 }}
          >
            <div className="px-4 py-2 border-b border-gray-800 bg-gray-950/80">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Wszystkie multipleksy</p>
            </div>
            {(Object.keys(RECEPTION) as ReceptionType[]).map(recType => {
              const cfgR = RECEPTION[recType];
              const muxList = multiplexes.filter(m => m.mux_type === REC_TO_MUX[recType]);
              if (muxList.length === 0) return null;
              return (
                <div key={recType}>
                  <div className={`px-4 py-1.5 flex items-center gap-2 border-b border-gray-800/60 ${cfgR.bg}`}>
                    <cfgR.Icon size={10} className={cfgR.color}/>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${cfgR.color}`}>{cfgR.label}</p>
                    {recType === reception && (
                      <span className="ml-auto text-[9px] text-gray-500">aktywny</span>
                    )}
                  </div>
                  {muxList.map(mux => {
                    const firstCh = allChannels.find(c => c.mux_id === mux.id);
                    const chCount = allChannels.filter(c => c.mux_id === mux.id).length;
                    return (
                      <button
                        key={mux.id}
                        onClick={() => jumpToMux(mux.id, recType)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center justify-between gap-3 transition-colors border-b border-gray-800/30 last:border-0"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            mux.status === 'active' ? cfgR.color.replace('text-','bg-') : 'bg-gray-600'
                          }`}/>
                          <span className="truncate">{mux.name}</span>
                        </span>
                        <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                          {chCount > 0
                            ? `→ ${String(firstCh!.lcn).padStart(3,'0')}`
                            : <span className="text-gray-700">brak kan.</span>
                          }
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* body */}
      <div className="flex flex-col xl:flex-row gap-0">

        {/* ═══ TV SCREEN ═══ */}
        <div className="flex-1 flex items-center justify-center p-5 xl:p-10">
          <div className="w-full max-w-2xl">
            <div className="bg-gradient-to-b from-gray-750 to-gray-800 rounded-2xl p-3 pb-4 shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-gray-700">
              <div className="relative bg-black rounded-xl overflow-hidden" style={{aspectRatio:'16/9'}}>

                {/* OFF */}
                {!powered && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-5">
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"/>
                    <div className="text-center">
                      <p className="text-gray-700 text-xs">
                        Naciśnij przycisk{' '}
                        <span className="inline-flex items-center gap-1 text-gray-500 font-semibold">
                          <Power size={10} className="inline"/> POWER
                        </span>{' '}
                        na pilocie
                      </p>
                      <p className="text-gray-800 text-xs mt-1">aby włączyć telewizor</p>
                    </div>
                  </div>
                )}

                {/* SWITCHING */}
                {powered && switching && (
                  <div className="absolute inset-0 bg-black flex items-center justify-center">
                    <div className="flex gap-1.5">
                      {[0,1,2].map(i=>(
                        <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*120}ms`}}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* NO CHANNELS */}
                {powered && !switching && !ch && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-center space-y-1">
                      <p className="text-gray-600 text-sm">Brak kanałów</p>
                      <p className={`text-xs ${rec.color}`}>dla trybu {rec.label}</p>
                    </div>
                  </div>
                )}

                {/* ON */}
                {powered && !switching && ch && (
                  <div className="absolute inset-0" ref={previewViewportRef}>
                    <div className="absolute inset-0"
                      style={{background:`radial-gradient(ellipse at 30% 40%, hsl(${(chIdx*47+200)%360},30%,12%) 0%,#0a0a0a 70%)`}}/>

                    {/* channel content */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {ch.channel_type==='radio' ? (
                        <div className="text-center px-6">
                          <div className="text-5xl mb-3 animate-pulse">📻</div>
                          <p className="text-gray-200 text-xl font-bold">{ch.name}</p>
                          {radioLoading && (
                            <div className="flex gap-1.5 justify-center mt-4">
                              {[0,1,2].map(i=>(
                                <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*120}ms`}}/>
                              ))}
                            </div>
                          )}
                          {radioError && (
                            <div className="mt-4 flex items-center justify-center gap-1.5 text-red-400 text-sm">
                              <AlertTriangle size={14}/>{radioError}
                            </div>
                          )}
                          {!radioLoading && !radioError && (
                            <div className="flex justify-center items-end gap-0.5 mt-5">
                              {Array.from({length:24}).map((_,i)=>(
                                <div key={i} className="w-1 rounded-sm bg-blue-500 animate-pulse"
                                  style={{height:`${8+Math.abs(Math.sin(i*0.6)*18)}px`,animationDelay:`${i*45}ms`,opacity:0.6+Math.sin(i)*0.4}}/>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : previewActive && ch.stream_url ? (
                        <>
                          <video
                            ref={previewRef}
                            className="absolute inset-0 h-full w-full object-cover"
                            playsInline
                            autoPlay
                            controls={false}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25 pointer-events-none" />
                          <button
                            onClick={togglePreviewFullscreen}
                            className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-black/70 hover:bg-black/85 border border-white/15 text-white flex items-center justify-center transition-colors"
                            title={previewFullscreen ? 'Wyjdź z fullscreen' : 'Fullscreen'}
                            aria-label={previewFullscreen ? 'Wyjdź z fullscreen' : 'Fullscreen'}
                          >
                            {previewFullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
                          </button>
                          {(previewLoading || previewError) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px] px-6 text-center">
                              <div>
                                {previewLoading && (
                                  <>
                                    <div className="mx-auto mb-4 flex gap-1.5 justify-center">
                                      {[0,1,2].map(i=>(
                                        <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*120}ms`}}/>
                                      ))}
                                    </div>
                                    <p className="text-white text-sm font-semibold">Ładowanie realtime preview…</p>
                                  </>
                                )}
                                {previewError && (
                                  <>
                                    <p className="text-red-300 text-sm font-semibold">{previewError}</p>
                                    <p className="text-gray-300 text-xs mt-2">
                                      Sprawdź, czy URL strumienia jest dostępny z przeglądarki i obsługuje odtwarzanie HTML5.
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center px-8">
                          <p className="text-gray-600 text-[10px] uppercase tracking-[0.3em] mb-2">{ch.mux_name}</p>
                          <p className="text-white text-3xl font-black tracking-tight">{ch.name}</p>
                          <p className="text-gray-500 text-sm mt-2">{ch.video_format} · {rec.label}</p>
                          {previewEligible && previewArmed && (
                            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-950/60 px-4 py-2">
                              <span className="text-blue-300 text-[10px] font-semibold uppercase tracking-[0.25em]">
                                Naciśnij OK aby załadować podgląd kanału
                              </span>
                            </div>
                          )}
                          <div className="mt-6 flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/>
                            <span className="text-gray-600 text-xs uppercase tracking-widest">na żywo</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* HUD top */}
                    <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
                      <div className="bg-black/75 backdrop-blur-sm rounded-lg px-3 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-2xl font-black leading-none ${rec.color}`}>{String(ch.lcn).padStart(2,'0')}</span>
                          <div>
                            <p className="text-white text-sm font-semibold leading-tight">{ch.name}</p>
                            <p className="text-gray-400 text-[10px] leading-tight">{ch.video_format}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="bg-black/75 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                          <div className="flex items-end gap-0.5">
                            {[3,5,7,9].map((h,i)=>(
                              <div key={i} className={`w-1 rounded-sm ${sig>i*25?rec.color.replace('text-','bg-'):'bg-gray-700'}`} style={{height:`${h}px`}}/>
                            ))}
                          </div>
                          <span className={`text-[10px] font-semibold ${rec.color}`}>{sig}%</span>
                        </div>
                        {ch.stream_url && !currentReachable && (
                          <div className="bg-black/80 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1 text-yellow-400 text-[10px] font-semibold">
                            <AlertTriangle size={10}/> Niedostępny
                          </div>
                        )}
                      </div>
                    </div>

                    {/* volume OSD */}
                    {osd?.vol && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-sm rounded-xl px-5 py-3 min-w-52">
                        <div className="flex items-center gap-3">
                          {muted||volume===0?<VolumeX size={16} className="text-gray-400"/>:<Volume2 size={16} className="text-white"/>}
                          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-white rounded-full transition-all duration-150" style={{width:`${muted?0:volume}%`}}/>
                          </div>
                          <span className="text-white text-xs w-7 text-right tabular-nums">{muted?'🔇':volume}</span>
                        </div>
                      </div>
                    )}

                    {/* text OSD */}
                    {osd?.msg && !osd?.vol && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-sm rounded-xl px-5 py-2.5">
                        <p className="text-white text-sm font-medium whitespace-nowrap">{osd?.msg}</p>
                      </div>
                    )}

                    {/* INFO overlay */}
                    {showInfo&&(
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-end">
                        <div className="w-full bg-gray-950/95 p-4 border-t border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-white font-bold text-base">{ch.name}</p>
                            <button onClick={()=>setShowInfo(false)} className="text-gray-500 hover:text-white p-1 rounded"><X size={16}/></button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            {([
                              ['LCN',ch.lcn],['MUX',ch.mux_name],['Format',ch.video_format],['Odbiór',rec.label],
                              ['Sygnał',`${sig}%`],['Status','Aktywny'],['Typ',ch.channel_type==='radio'?'📻 Radio':'📺 TV'],['MUX typ',ch.mux_type?.toUpperCase()],
                            ] as [string,string|number][]).map(([l,v])=>(
                              <div key={l} className="bg-gray-800/80 rounded-lg px-3 py-2">
                                <p className="text-gray-500 mb-0.5">{l}</p>
                                <p className="text-white font-semibold">{v}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MENU overlay */}
                    {showMenu&&(
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-start p-6">
                        <div className="bg-gray-900/98 rounded-xl border border-gray-700 overflow-hidden w-60 shadow-2xl">
                          <div className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 text-white ${rec.bg}`}>
                            <Home size={14}/>Menu główne
                          </div>
                          {MENU_ITEMS.map((item,i)=>(
                            <button key={item} onClick={()=>handleMenuSelect(item,i)}
                              className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors border-b border-gray-800/50 last:border-0 ${
                                menuIdx===i?`${rec.bg} ${rec.color} font-semibold`:'text-gray-300 hover:bg-gray-800'
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${menuIdx===i?'bg-current':'bg-gray-700'}`}/>
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SYSTEM INFO overlay */}
                    {showSysInfo&&(
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-gray-950/98 rounded-xl border border-gray-700 w-full max-w-sm shadow-2xl">
                          <div className={`px-4 py-3 flex items-center justify-between rounded-t-xl border-b border-gray-800 ${rec.bg}`}>
                            <p className={`font-semibold text-sm flex items-center gap-2 ${rec.color}`}>
                              <Cpu size={14}/>Informacje o systemie
                            </p>
                            <button onClick={()=>setShowSysInfo(false)} className="text-gray-500 hover:text-white p-1 rounded"><X size={14}/></button>
                          </div>
                          <div className="px-4 pt-3 pb-1">
                            <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                              <Signal size={9}/>Dekoder
                            </p>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              {([
                                ['Model','vMUX Emulator v1.0'],
                                ['Tryb odbioru',rec.label],
                                ['Kanałów w trybie',String(channels.length)],
                                ['Sygnał',`${sig}%`],
                                ['Multipleksów',String(multiplexes.filter(m => m.mux_type === REC_TO_MUX[reception]).length)],
                                ['Aktualny kanał',ch?ch.name:'—'],
                              ] as [string,string][]).map(([l,v])=>(
                                <div key={l} className="bg-gray-800/80 rounded-lg px-2.5 py-1.5">
                                  <p className="text-gray-500 text-[10px] mb-0.5">{l}</p>
                                  <p className="text-white font-semibold truncate">{v}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="px-4 pt-3 pb-4">
                            <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                              <Database size={9}/>Baza danych
                            </p>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              {([
                                ['Silnik DB',sysInfo?.dbType??'…'],
                                ['Kanałów łącznie',String(sysInfo?.counts.channels??'…')],
                                ['Multipleksów',String(sysInfo?.counts.multiplexes??'…')],
                                ['Węzły SFN',String(sysInfo?.counts.sfnNodes??'…')],
                                ['Strumienie',String(sysInfo?.counts.streams??'…')],
                                ['Zdarzenia',String(sysInfo?.counts.events??'…')],
                              ] as [string,string][]).map(([l,v])=>(
                                <div key={l} className="bg-gray-800/80 rounded-lg px-2.5 py-1.5">
                                  <p className="text-gray-500 text-[10px] mb-0.5">{l}</p>
                                  <p className="text-white font-semibold">{v}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="px-4 py-2 border-t border-gray-800 text-center">
                            <p className="text-gray-700 text-[10px]">vMUX · Wirtualny Multipleks · {new Date().getFullYear()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* chin */}
              <div className="flex items-center justify-between mt-3 px-2">
                <span className="text-gray-700 text-[10px] tracking-widest uppercase">
                  vMUX TV · {rec.label}
                  {channels.length>0&&<span className="ml-2 text-gray-800">({channels.length} kan.)</span>}
                </span>
                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${powered?`animate-pulse ${rec.color.replace('text-','bg-')}`:'bg-red-700'}`}/>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ REMOTE ═══ */}
        <div className="flex-shrink-0 flex items-start justify-center px-4 pb-6 xl:pt-8 xl:pr-8 xl:pb-8">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-5 w-48 shadow-[0_8px_40px_rgba(0,0,0,0.7)] border border-gray-700 flex flex-col gap-4">

            <div className="flex items-center justify-between">
              <button onClick={()=>setPowered(v=>!v)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${powered?'bg-red-600 hover:bg-red-700 shadow-red-900/60 text-white':'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}
                title="Power (P)"><Power size={17}/></button>
              <button onClick={cycleReception}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border border-current/25 ${rec.bg} ${rec.color}`}
                title="Zmień typ odbioru (T)">{rec.label}</button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {['1','2','3','4','5','6','7','8','9','','0',''].map((n,i)=>(
                <button key={i} onClick={()=>n&&pressNum(n)}
                  className={`h-9 rounded-xl text-sm font-mono font-bold transition-colors active:scale-90 ${n?'bg-gray-700 hover:bg-gray-600 text-white shadow-sm':'pointer-events-none'}`}>
                  {n}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {([
                {label:'CH+',onClick:chUp,icon:<ChevronUp size={14}/>},
                {label:'VOL+',onClick:volUp,icon:<ChevronUp size={14}/>},
                {label:'CH−',onClick:chDown,icon:<ChevronDown size={14}/>},
                {label:'VOL−',onClick:volDown,icon:<ChevronDown size={14}/>},
              ]).map(({label,onClick,icon})=>(
                <button key={label} onClick={onClick}
                  className="flex flex-col items-center justify-center py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors active:scale-90 shadow-sm">
                  {icon}<span className="text-[9px] text-gray-400 mt-0.5 font-mono">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <button onClick={chUp} title="CH+ (↑)" className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-11 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors active:scale-90 shadow"><ChevronUp size={18}/></button>
                <button onClick={chDown} title="CH− (↓)" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-11 h-11 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors active:scale-90 shadow"><ChevronDown size={18}/></button>
                <button onClick={volDown} title="VOL− (←)" className="absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors active:scale-90 shadow"><ChevronLeft size={18}/></button>
                <button onClick={volUp} title="VOL+ (→)" className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-white transition-colors active:scale-90 shadow"><ChevronRight size={18}/></button>
                <button
                  onClick={()=>{if(showMenu)handleMenuSelect(MENU_ITEMS[menuIdx],menuIdx);else if(numBuf)commitNumericZap();else activatePreview();}}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all active:scale-90 shadow-lg ring-2 ${rec.ring}`}
                  style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>OK
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={()=>{if(powered)setShowMenu(v=>!v);}}
                className="h-9 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-300 text-[10px] flex items-center justify-center gap-1 transition-colors active:scale-90">
                <Home size={10}/>Menu
              </button>
              <button onClick={()=>{if(powered)setShowInfo(v=>!v);}}
                className="h-9 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-300 text-[10px] flex items-center justify-center gap-1 transition-colors active:scale-90">
                <Info size={10}/>Info
              </button>
              <button onClick={toggleMute}
                className={`h-9 rounded-xl text-[10px] flex items-center justify-center gap-1 transition-colors active:scale-90 ${muted?'bg-red-700 text-white':'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                {muted?<VolumeX size={10}/>:<Volume2 size={10}/>}{muted?'Mute':'Dźwięk'}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {([
                ['bg-red-600 hover:bg-red-500',openTeletext],
                ['bg-green-600 hover:bg-green-500',()=>flashOsd('Ulubione')],
                ['bg-yellow-500 hover:bg-yellow-400',openChannelList],
                ['bg-blue-600 hover:bg-blue-500',()=>{if(powered)setShowSysInfo(v=>!v);}],
              ] as [string,()=>void][]).map(([cls,fn],i)=>(
                <button key={i} onClick={fn}
                  className={`h-7 ${cls} rounded-lg text-white text-base transition-colors active:scale-90 flex items-center justify-center`}
                  title={i===3?'Informacje o systemie':undefined}>●</button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* HELP modal */}
      {showHelp&&(
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <p className="text-white font-semibold">Skróty klawiaturowe</p>
                <p className="text-xs text-gray-500 mt-0.5">vMUX Emulator – sterowanie klawiaturą i pilotem</p>
              </div>
              <button onClick={()=>setShowHelp(false)} className="text-gray-600 hover:text-white p-1.5 rounded-lg hover:bg-gray-800"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-2.5">
              {SHORTCUTS.map(({key,desc})=>(
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-gray-400 text-sm">{desc}</span>
                  <kbd className="shrink-0 bg-gray-800 text-gray-200 text-xs px-2.5 py-1 rounded-lg border border-gray-700 font-mono">{key}</kbd>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-600">
                <strong className="text-gray-500">PPM / przytrzymaj</strong> na pasku tytułu → lista wszystkich multipleksów ·{' '}
                <strong className="text-gray-500">niebieski ●</strong> → info o systemie
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
