'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* backdrop: z-40 – above header (z-30), below sidebar (z-50)
          always in DOM, opacity transition so clicks pass through when closed */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-200 lg:hidden z-40 ${
          sidebarOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuToggle={() => setSidebarOpen(o => !o)} />
      <main className="lg:ml-60 pt-14 min-h-screen bg-gray-50">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </>
  );
}
