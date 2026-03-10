import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "vMUX Panel – Wirtualny Multiplekser",
  description: "Panel zarządzania wirtualnymi multipleksami DVB-T2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">
        <Sidebar />
        <Header />
        <main className="ml-60 pt-14 min-h-screen">
          <div className="p-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
