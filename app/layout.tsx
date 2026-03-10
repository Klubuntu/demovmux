import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import SetupWizard from "@/components/SetupWizard";

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
        <SetupWizard />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
