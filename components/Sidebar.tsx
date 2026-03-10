'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Radio, Tv2, Signal, GitBranch, BarChart2,
  Table2, Bell, Settings, CalendarDays
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/multipleksy', label: 'Multipleksy', icon: Radio },
  { href: '/kanaly', label: 'Kanały', icon: Tv2 },
  { href: '/epg', label: 'EPG', icon: CalendarDays },
  { href: '/strumienie', label: 'Strumienie wejściowe', icon: Signal },
  { href: '/sfn', label: 'Węzły SFN', icon: GitBranch },
  { href: '/monitoring', label: 'Monitoring', icon: BarChart2 },
  { href: '/tablice', label: 'Tablice PSI/SI', icon: Table2 },
  { href: '/zdarzenia', label: 'Zdarzenia / Logi', icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Radio size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">vMUX Panel</p>
            <p className="text-[10px] text-gray-400 leading-tight">Wirtualny multiplekser</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100">
        <Link href="/ustawienia" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <Settings size={14} />
          Ustawienia systemu
        </Link>
        <p className="text-[10px] text-gray-300 mt-2">vMUX v1.0 · SQLite</p>
      </div>
    </aside>
  );
}
