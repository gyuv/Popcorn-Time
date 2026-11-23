import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import Grid from '../components/Grid.jsx';

export default function Library() {
  const st = useStore();
  const [tab, setTab] = useState('watchlist');
  const [sort, setSort] = useState('added');
  const [type, setType] = useState('all');
  const src = {
    watchlist: Object.values(st.watchlist),
    watched: Object.values(st.watched).filter(x => x.ep === undefined),
    rated: Object.values(st.ratings).filter(x => x.value > 0),
    history: st.history,
  }[tab];
  const items = src.filter(i => type === 'all' || i.type === type).sort((a, b) =>
    sort === 'title' ? a.title.localeCompare(b.title) : sort === 'rating' ? b.rating - a.rating :
    sort === 'year' ? (b.date || '').localeCompare(a.date || '') : (b.added || b.at || 0) - (a.added || a.at || 0));
  const epsWatched = Object.values(st.watched).filter(x => x.ep !== undefined).length;
  return (
    <div className="page">
      <div className="pagehead"><h1>Library</h1><span className="muted">{Object.keys(st.watchlist).length} saved · {Object.values(st.watched).filter(x => x.ep === undefined).length} watched · {epsWatched} episodes</span></div>
      <div className="chips">{[['watchlist', 'Watchlist'], ['watched', 'Watched'], ['rated', 'My ratings'], ['history', 'Recently viewed']].map(([k, n]) =>
        <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>)}</div>
      <div className="frow">
        <label>Type<select value={type} onChange={e => setType(e.target.value)}><option value="all">All</option><option value="movie">Movies</option><option value="tv">Series</option></select></label>
        <label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="added">Date added</option><option value="title">Title</option><option value="rating">Rating</option><option value="year">Year</option></select></label>
      </div>
      {items.length ? <Grid items={items} /> : <p className="muted center">Nothing here yet.</p>}
    </div>
  );
}
