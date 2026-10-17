'use client';

import Link from 'next/link';
import { useState } from 'react';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-surface border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">
            Eloane<span className="text-accent">'s</span> Koora
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/" className="hover:text-accent transition">Home</Link>
          <Link href="/catalog" className="hover:text-accent transition">Catalog</Link>
        </div>

        <button
          className="md:hidden text-2xl"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/5 px-4 py-3 flex flex-col gap-3 text-sm">
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/catalog" onClick={() => setMenuOpen(false)}>Catalog</Link>
        </div>
      )}
    </nav>
  );
}
