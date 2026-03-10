'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  HelpCircle, X, Power, Volume2, VolumeX, Info, Home,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Wifi, Satellite, Radio, Signal, Cpu, Database,
} from 'lucide-react';

// ─────────────────────────── types ───────────────────────────
interface Channel {
  id: number; name: string; lcn: number; mux_name: string; mux_id: number;
  mux_type: string; video_format: string; channel_type: string; status: string;
}
interface Multiplex {
  id: number; name: string; number: number; standard: string;
  mux_type: string; status: string; channel_count: number;
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

  const [osd, setOsd]       = useState<{ msg: string; vol: boolean } | null>(null);
  const [numBuf, setNumBuf] = useState('');
  const osdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    fetch('/api/channels').then(r => r.json())
      .then((d: Channel[]) => setAllChannels(d.filter(c => c.status === 'active')));
    fetch('/api/multiplexes').then(r => r.json()).then(setMultiplexes);
    fetch('/api/settings').then(r => r.json()).then(setSysInfo).catch(() => null);
  }, []);

  // filter channels when reception or allChannels changes, reset to first
  useEffect(() => {
    const muxType = REC_TO_MUX[reception];
    setChannels(allChannels.filter(c => c.mux_type === muxType));
    setChIdx(0);
  }, [reception, allChannels]);

  // close context menu on any outside pointer-down
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('pointerdown', close, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', close, { capture: true });
  }, [ctxMenu]);

  const flashOsd = useCallback((msg: string, vol = false) => {
    setOsd({ msg, vol });
    if (osdTimer.current) clearTimeout(osdTimer.current);
    osdTimer.current = setTimeout(() => setOsd(null), 2500);
  }, []);

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

  const pressNum = useCallback((n: string) => {
    if (!powered) return;
    const buf = (numBuf + n).slice(-3);
    setNumBuf(buf);
    flashOsd(`Kanał: ${buf}`);
    if (numTimer.current) clearTimeout(numTimer.current);
    numTimer.current = setTimeout(() => {
      const target = parseInt(buf) - 1;
      if (target >= 0 && target < channels.length) {
        setSwitching(true);
        setTimeout(() => { setChIdx(target); setSwitching(false); }, 200);
      }
      setNumBuf('');
    }, 1500);
  }, [powered, numBuf, channels, flashOsd]);

  const jumpToMux = useCallback((muxId: number) => {
    const idx = channels.findIndex(c => c.mux_id === muxId);
    const mux = multiplexes.find(m => m.id === muxId);
    setCtxMenu(null);
    flashOsd(`MUX: ${mux?.name ?? '–'}`);
    if (!powered || idx < 0) return;
    setSwitching(true);
    setTimeout(() => { setChIdx(idx); setSwitching(false); }, 200);
  }, [channels, multiplexes, powered, flashOsd]);

  const handleTitleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMenuSelect = useCallback((item: string, idx: number) => {
    setMenuIdx(idx);
    setShowMenu(false);
    if (item === 'Informacje o systemie') setShowSysInfo(true);
    else flashOsd(item);
  }, [flashOsd]);

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); if (showMenu) setMenuIdx(i => Math.max(0, i-1)); else chUp(); break;
        case 'ArrowDown':  e.preventDefault(); if (showMenu) setMenuIdx(i => Math.min(MENU_ITEMS.length-1, i+1)); else chDown(); break;
        case 'ArrowLeft':  e.preventDefault(); volDown(); break;
        case 'ArrowRight': e.preventDefault(); volUp();   break;
        case 'Enter':      e.preventDefault(); if (showMenu) handleMenuSelect(MENU_ITEMS[menuIdx], menuIdx); break;
        case 'Escape': case 'Backspace':
          setShowMenu(false); setShowInfo(false); setShowHelp(false); setShowSysInfo(false); setCtxMenu(null); break;
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
  }, [chUp, chDown, volUp, volDown, cycleReception, pressNum, powered, showMenu, menuIdx, handleMenuSelect]);

  const ch  = channels[chIdx];
  const rec = RECEPTION[reception];
  const sig = 72 + ((chIdx * 7 + 13) % 22);
  const muxesForReception = multiplexes.filter(m => m.mux_type === REC_TO_MUX[reception]);

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

      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-white font-bold text-sm shrink-0 cursor-context-menu select-none"
            onContextMenu={handleTitleRightClick}
            title="PPM → lista multipleksów bieżącego trybu"
          >
            vMUX Emulator
          </span>
          <button
            onClick={cycleReception}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-current/30 transition-all hover:opacity-80 active:scale-95 shrink-0 ${rec.bg} ${rec.color}`}
            title="LPM: zmień typ odbioru (T) · PPM na tytule: lista MUX"
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
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800 shrink-0">
          <HelpCircle size={13}/>Pomoc
        </button>
      </div>

      {/* context menu – MUX list */}
      {ctxMenu && (
        <div
          className="fixed z-[200] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-2 min-w-56 overflow-hidden"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className={`px-4 py-2 flex items-center gap-2 border-b border-gray-800 ${rec.bg}`}>
            <rec.Icon size={11} className={rec.color}/>
            <p className={`text-xs font-semibold ${rec.color}`}>{rec.label} · multipleksy</p>
          </div>
          {muxesForReception.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-600 text-center">
              Brak multipleksów<br/>
              <span className="text-xs text-gray-700">dla trybu {rec.label}</span>
            </p>
          ) : muxesForReception.map(mux => {
            const firstCh = channels.find(c => c.mux_id === mux.id);
            return (
              <button key={mux.id} onClick={() => jumpToMux(mux.id)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center justify-between gap-3 transition-colors">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    mux.status === 'active' ? rec.color.replace('text-','bg-') : 'bg-gray-600'
                  }`}/>
                  <span className="truncate">{mux.name}</span>
                </span>
                <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                  {firstCh ? `→ ${String(firstCh.lcn).padStart(3,'0')}` : `${mux.channel_count} kan.`}
                </span>
              </button>
            );
          })}
        </div>
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
                  <div className="absolute inset-0">
                    <div className="absolute inset-0"
                      style={{background:`radial-gradient(ellipse at 30% 40%, hsl(${(chIdx*47+200)%360},30%,12%) 0%,#0a0a0a 70%)`}}/>

                    {/* channel content */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {ch.channel_type==='radio' ? (
                        <div className="text-center">
                          <div className="text-5xl mb-3 animate-pulse">📻</div>
                          <p className="text-gray-200 text-xl font-bold">{ch.name}</p>
                          <div className="flex justify-center items-end gap-0.5 mt-5">
                            {Array.from({length:24}).map((_,i)=>(
                              <div key={i} className="w-1 rounded-sm bg-blue-500 animate-pulse"
                                style={{height:`${8+Math.abs(Math.sin(i*0.6)*18)}px`,animationDelay:`${i*45}ms`,opacity:0.6+Math.sin(i)*0.4}}/>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center px-8">
                          <p className="text-gray-600 text-[10px] uppercase tracking-[0.3em] mb-2">{ch.mux_name}</p>
                          <p className="text-white text-3xl font-black tracking-tight">{ch.name}</p>
                          <p className="text-gray-500 text-sm mt-2">{ch.video_format} · {rec.label}</p>
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
                        <div className="bg-black/75 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs text-gray-200 font-mono tabular-nums">
                          {new Date().toLocaleTimeString('pl',{hour:'2-digit',minute:'2-digit'})}
                        </div>
                        <div className="bg-black/75 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                          <div className="flex items-end gap-0.5">
                            {[3,5,7,9].map((h,i)=>(
                              <div key={i} className={`w-1 rounded-sm ${sig>i*25?rec.color.replace('text-','bg-'):'bg-gray-700'}`} style={{height:`${h}px`}}/>
                            ))}
                          </div>
                          <span className={`text-[10px] font-semibold ${rec.color}`}>{sig}%</span>
                        </div>
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
                    {osd&&!osd.vol&&(
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-sm rounded-xl px-5 py-2.5">
                        <p className="text-white text-sm font-medium whitespace-nowrap">{osd.msg}</p>
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
                                ['Multipleksów',String(muxesForReception.length)],
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
                  onClick={()=>{if(showMenu)handleMenuSelect(MENU_ITEMS[menuIdx],menuIdx);else flashOsd('OK');}}
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
                ['bg-red-600 hover:bg-red-500',()=>flashOsd('Teletext')],
                ['bg-green-600 hover:bg-green-500',()=>flashOsd('Ulubione')],
                ['bg-yellow-500 hover:bg-yellow-400',()=>flashOsd('Lista kanałów')],
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
                <strong className="text-gray-500">PPM</strong> na „vMUX Emulator&rdquo; → lista MUX bieżącego trybu ·{' '}
                <strong className="text-gray-500">niebieski ●</strong> → info o systemie
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
