'use client';
import { LogOut, Menu } from 'lucide-react';

interface HeaderProps { onMenuToggle?: () => void; }

export default function Header({ onMenuToggle }: HeaderProps = {}) {
  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 lg:px-6 z-30">
      <div className="flex items-center gap-2">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Menu">
          <Menu size={20} />
        </button>
        <h1 className="text-base font-bold text-gray-900">Panel vMUX</h1>
      </div>
      <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
        <LogOut size={14} />
        <span className="hidden sm:inline">Wyloguj</span>
      </button>
    </header>
  );
}
