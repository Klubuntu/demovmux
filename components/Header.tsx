'use client';
import { useState, useEffect } from 'react';
import { LogOut, Wifi, WifiOff, AlertTriangle, Menu } from 'lucide-react';

type ServiceStatus = { status: 'active' | 'maintenance' | 'blocked'; message: string | null };
interface HeaderProps { onMenuToggle?: () => void; }

const statusConfig = {
  active: { label: 'Przyjmujemy zgłoszenia', sub: 'Wirtualny MUX aktywny', color: 'bg-blue-600', dot: 'bg-blue-400', icon: Wifi },
  maintenance: { label: 'Przerwa techniczna', sub: 'Czasowo wyłączony', color: 'bg-orange-500', dot: 'bg-orange-400', icon: AlertTriangle },
  blocked: { label: 'MUX zablokowany', sub: 'Emisja wstrzymana', color: 'bg-red-500', dot: 'bg-red-400', icon: WifiOff },
};

export default function Header({ onMenuToggle }: HeaderProps = {}) {
  const [svc, setSvc] = useState<ServiceStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setSvc);
  }, []);

  const changeStatus = async (newStatus: ServiceStatus['status']) => {
    setSaving(true);
    const res = await fetch('/api/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, message: svc?.message }),
    });
    const data = await res.json();
    setSvc(data);
    setSaving(false);
  };

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 lg:px-6 z-20">
      <div className="flex items-center gap-2">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Menu">
          <Menu size={20} />
        </button>
        <h1 className="text-base font-bold text-gray-900">Panel vMUX</h1>
      </div>
      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-4 text-sm">
          {(['active', 'maintenance', 'blocked'] as const).map(s => {
            const cfg = statusConfig[s];
            const active = svc?.status === s;
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={saving || active}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  active
                    ? s === 'active' ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : s === 'maintenance' ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : 'bg-gray-300'}`} />
                {cfg.label}
              </button>
            );
          })}
        </nav>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
          <LogOut size={14} />
          Wyloguj
        </button>
      </div>
    </header>
  );
}
