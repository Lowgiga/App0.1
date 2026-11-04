import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cue Command Mesh · lowgiga",
  description: "Privates Agenten-Cockpit mit belegten Verbindungen, PAZ-Pilot, Make-Prüfung und Übergaben.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
