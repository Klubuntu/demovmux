'use client';
import { useEffect, useState } from 'react';
import { Database, CheckCircle2, Loader2, XCircle, Sparkles } from 'lucide-react';

type Phase = 'checking' | 'empty' | 'seeding' | 'done' | 'error' | 'nonempty';

export default function SetupWizard() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then((data: { empty: boolean }) => {
        setPhase(data.empty ? 'empty' : 'nonempty');
      })
      .catch(() => setPhase('nonempty')); // on error, don't block the UI
  }, []);

  async function handleSeed() {
    setPhase('seeding');
    try {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setPhase('done');
        // reload after 1.5s so all pages get fresh data
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setErrorMsg(data.error ?? 'Nieznany błąd.');
        setPhase('error');
      }
    } catch (e) {
      setErrorMsg(String(e));
      setPhase('error');
    }
  }

  function handleSkip() {
    setPhase('nonempty');
  }

  // Only show overlay when relevant
  if (phase === 'checking' || phase === 'nonempty') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center gap-3">
          <Database className="w-7 h-7 text-white flex-shrink-0" />
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Kreator pierwszej konfiguracji</h2>
            <p className="text-blue-100 text-xs mt-0.5">vMUX Panel – konfiguracja bazy danych</p>
          </div>
        </div>

        <div className="px-6 py-6">
          {phase === 'empty' && (
            <>
              <div className="flex items-start gap-3 mb-5">
                <Sparkles className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm leading-relaxed">
                  Baza danych jest <strong>pusta</strong>. Czy chcesz wstawić dane demonstracyjne?
                  Zawierają przykładowe multipleksy DVB-T2, kanały, strumienie wejściowe,
                  węzły SFN, EPG oraz kanały radiowe.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-xs text-blue-800 space-y-1">
                <div className="font-semibold mb-1">Dane przykładowe obejmują:</div>
                <div>🔵 6 multipleksów DVB-T2/DVB-T (MUX 1–8)</div>
                <div>📺 20+ kanałów telewizyjnych HD</div>
                <div>🌐 Wirtualny multipleks IPTV z 8 kanałami</div>
                <div>📻 12 kanałów radiowych (Icecast)</div>
                <div>📡 8 węzłów SFN z danymi GPS</div>
                <div>📋 EPG na 4 dni</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSeed}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Database className="w-4 h-4" />
                  Wstaw dane przykładowe
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                >
                  Pomiń
                </button>
              </div>
            </>
          )}

          {phase === 'seeding' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">Wstawianie danych…</p>
                <p className="text-sm text-gray-500 mt-1">Proszę czekać, to może zająć chwilę.</p>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">Dane wstawione pomyślnie!</p>
                <p className="text-sm text-gray-500 mt-1">Strona zostanie odświeżona za chwilę…</p>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <XCircle className="w-10 h-10 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">Wystąpił błąd</p>
                <p className="text-xs text-red-600 mt-1 break-all max-h-24 overflow-y-auto">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={handleSeed}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Spróbuj ponownie
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  Zamknij
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
