export function HeroLink() {
  return (
    <section className="relative overflow-hidden rounded-3xl mb-10 px-6 py-14 text-center bg-gradient-to-br from-accent/20 via-surface to-accent/10 border border-white/10 shadow-2xl">
      <p className="text-accent tracking-widest uppercase text-sm mb-3">Les matchs en direct</p>
      <h1 className="text-4xl md:text-6xl font-extrabold mb-4">
        Bienvenue <span className="bg-gradient-to-r from-accent to-emerald-300 bg-clip-text text-transparent">Eloane</span>
      </h1>
      <p className="text-text-muted max-w-xl mx-auto mb-8">
        Tous les matchs en direct. Clique ci-dessous pour ouvrir Koora Live.
      </p>
      <a
        href="https://www.google.com/search?q=koora+live"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-full bg-gradient-to-r from-accent to-emerald-500 px-10 py-5 text-xl md:text-2xl font-bold text-white shadow-lg shadow-accent/40 transition hover:scale-105"
      >
        Koora Live
      </a>
    </section>
  );
}
