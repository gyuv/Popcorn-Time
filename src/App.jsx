import { useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useStore } from './lib/store.jsx';
import { ACCENTS } from './lib/constants.js';
import Setup from './pages/Setup.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import Search from './pages/Search.jsx';
import Details from './pages/Details.jsx';
import Library from './pages/Library.jsx';
import Settings from './pages/Settings.jsx';
import Player from './pages/Player.jsx';
import Person from './pages/Person.jsx';

const NAV = [
  ['/', 'Home', '🏠'], ['/search', 'Search', '🔎'], ['/browse/movie', 'Movies', '🎬'], ['/browse/tv', 'Series', '📺'],
  ['/browse/anime', 'Anime', '🌸'], ['/library', 'Library', '📚'], ['/player', 'My Files', '▶️'], ['/settings', 'Settings', '⚙️'],
];

export default function App() {
  const { token, prefs } = useStore();
  const loc = useLocation();
  useEffect(() => {
    const a = ACCENTS[prefs.accent] || ACCENTS.violet;
    const r = document.documentElement;
    r.style.setProperty('--accent', a.a); r.style.setProperty('--accent-2', a.b);
    r.dataset.theme = prefs.theme; r.dataset.card = prefs.cardSize;
  }, [prefs.accent, prefs.theme, prefs.cardSize]);
  useEffect(() => { document.querySelector('main')?.scrollTo(0, 0); }, [loc.pathname]);

  if (!token) return <Setup />;
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand"><img src="icons/icon-192.png" alt="" /><span>Popcorn<b>Time</b></span></div>
        {NAV.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className="navlink"><span className="ico">{icon}</span><span className="lbl">{label}</span></NavLink>
        ))}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/browse/:kind" element={<Browse />} />
          <Route path="/title/:type/:id" element={<Details />} />
          <Route path="/person/:id" element={<Person />} />
          <Route path="/library" element={<Library />} />
          <Route path="/player" element={<Player />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <footer className="foot">Metadata &amp; images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by JustWatch via TMDB.</footer>
      </main>
    </div>
  );
}
