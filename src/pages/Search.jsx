import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';
import { tmdb, norm, IMG } from '../lib/tmdb.js';
import Grid from '../components/Grid.jsx';

export default function Search() {
  const { prefs } = useStore();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [kind, setKind] = useState('all');
  const [res, setRes] = useState({ items: [], people: [] });
  useEffect(() => {
    const t = setTimeout(() => {
      setSp(q ? { q } : {}, { replace: true });
      if (q.trim().length < 2) return setRes({ items: [], people: [] });
      tmdb('/search/multi', { query: q, language: prefs.uiLocale, include_adult: prefs.hideAdult ? 'false' : 'true' }).then(r => setRes({
        items: r.results.filter(x => x.media_type !== 'person').map(x => norm(x)),
        people: r.results.filter(x => x.media_type === 'person'),
      })).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, prefs.uiLocale]);
  const langs = prefs.contentLanguages;
  // Results in the user's preferred languages float to the top.
  const items = res.items.filter(i => kind === 'all' || i.type === kind)
    .sort((a, b) => (langs.includes(b.lang) ? 1 : 0) - (langs.includes(a.lang) ? 1 : 0));
  return (
    <div className="page">
      <input className="searchbox" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search movies, series, anime, people…" />
      <div className="chips">{[['all', 'All'], ['movie', 'Movies'], ['tv', 'Series']].map(([k, n]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{n}</button>)}</div>
      {res.people.length > 0 && <div className="people">{res.people.slice(0, 8).map(p => (
        <Link key={p.id} to={`/person/${p.id}`} className="person"><img src={IMG(p.profile_path, 'w185') || 'icons/icon-192.png'} alt="" /><span>{p.name}</span></Link>))}</div>}
      <Grid items={items} />
    </div>
  );
}
