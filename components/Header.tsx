'use client';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeaderProps { onMenuToggle?: () => void; }

export default function Header({ onMenuToggle }: HeaderProps = {}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vmux-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('vmux-theme', next ? 'dark' : 'light');
  };

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 lg:px-6 z-30">
      <div className="flex items-center gap-2">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Menu">
          <Menu size={20} />
        </button>
        <h1 className="text-base font-bold text-gray-900">Panel vMUX</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
          aria-label={dark ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
          title={dark ? 'Jasny motyw' : 'Ciemny motyw'}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          <span className="hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
        </button>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
          <LogOut size={14} />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </div>
    </header>
  );
}
