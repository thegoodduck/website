import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AutoTranslate } from '@/components/layout/AutoTranslate';
import { Intro } from '@/components/layout/Intro';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eloane — Koora Live',
  description: 'Watch live football matches and sports streams for free. P2P powered.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen flex flex-col">
        <Intro />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <AutoTranslate />
      </body>
    </html>
  );
}
