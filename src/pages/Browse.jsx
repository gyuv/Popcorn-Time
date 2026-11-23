import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useStore, useAsync } from '../lib/store.jsx';
import { tmdb, norm } from '../lib/tmdb.js';
import { COUNTRIES, LANGUAGES, SORTS } from '../lib/constants.js';
import Grid from '../components/Grid.jsx';

const TITLES = { movie: 'Movies', tv: 'Series', anime: 'Anime' };

export default function Browse() {
  const { kind } = useParams();
  const type = kind === 'movie' ? 'movie' : 'tv';
  const { prefs, setPrefs } = useStore();
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(sp);
  const set = patch => { const n = { ...f, ...patch }; Object.keys(n).forEach(k => (n[k] === '' || n[k] == null) && delete n[k]); setSp(n, { replace: true }); };

  const genres = useAsync(() => tmdb(`/genre/${type}/list`, { language: prefs.uiLocale }).then(r => r.genres), [type, prefs.uiLocale]);
  const region = f.region || prefs.country;
  const providers = useAsync(() => (region ? tmdb(`/watch/providers/${type}`, { watch_region: region }).then(r => r.results.sort((a, b) => a.display_priorities?.[region] - b.display_priorities?.[region]).slice(0, 40)) : Promise.resolve([])), [type, region]);

  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const key = `${kind}|${sp.toString()}|${prefs.uiLocale}|${prefs.hideAdult}|${prefs.services.join()}`;

  const params = p => {
    const sortRaw = f.sort || 'popularity.desc';
    const sort = type === 'tv' ? sortRaw.replace('primary_release_date', 'first_air_date').replace('original_title', 'original_name').replace('revenue.desc', 'popularity.desc') : sortRaw;
    const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
    const genresSel = [f.genres, kind === 'anime' ? '16' : ''].filter(Boolean).join(',');
    const provs = f.mine ? prefs.services.join('|') : f.providers;
    return {
      page: p, language: prefs.uiLocale, sort_by: sort, include_adult: prefs.hideAdult ? 'false' : 'true',
      with_genres: genresSel, without_genres: f.exclude,
      with_original_language: kind === 'anime' ? (f.lang || 'ja') : f.lang,
      with_origin_country: f.country,
      [`${dateKey}.gte`]: f.from ? `${f.from}-01-01` : undefined,
      [`${dateKey}.lte`]: f.to ? `${f.to}-12-31` : undefined,
      'vote_average.gte': f.rating, 'vote_count.gte': f.votes ?? (sort.startsWith('vote_average') ? 200 : 10),
      'with_runtime.gte': f.rmin, 'with_runtime.lte': f.rmax,
      with_watch_providers: provs, watch_region: provs || f.free ? region : undefined,
      with_watch_monetization_types: f.free ? 'free|ads' : undefined,
      certification_country: f.cert && region ? region : undefined, 'certification.lte': f.cert && region ? f.cert : undefined,
      with_keywords: f.kw,
    };
  };

  useEffect(() => { setItems([]); setPage(1); }, [key]);
  useEffect(() => {
    let alive = true; setLoading(true);
    tmdb(`/discover/${type}`, params(page)).then(r => {
      if (!alive) return;
      setTotal(r.total_results);
      setItems(prev => [...(page === 1 ? [] : prev), ...r.results.map(x => norm(x, type))]);
    }).catch(() => {}).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page]);

  const selGenres = (f.genres || '').split(',').filter(Boolean);
  const toggleGenre = id => { const s = new Set(selGenres); s.has(String(id)) ? s.delete(String(id)) : s.add(String(id)); set({ genres: [...s].join(',') }); };
  const selProv = (f.providers || '').split('|').filter(Boolean);
  const toggleProv = id => { const s = new Set(selProv); s.has(String(id)) ? s.delete(String(id)) : s.add(String(id)); set({ providers: [...s].join('|'), mine: '' }); };
  const savePreset = () => { const name = prompt('Name this filter'); if (name) setPrefs({ savedFilters: [...prefs.savedFilters, { name, kind, query: sp.toString() }] }); };
  const presets = prefs.savedFilters.filter(p => p.kind === kind);
  const [open, setOpen] = useState(true);

  return (
    <div className="page">
      <div className="pagehead">
        <h1>{TITLES[kind]}</h1>
        <span className="muted">{total.toLocaleString()} titles</span>
        <button className="btn ghost" onClick={() => setOpen(o => !o)}>{open ? 'Hide filters' : 'Show filters'}</button>
      </div>
      {presets.length > 0 && <div className="chips">{presets.map((p, i) => <button key={i} className="chip" onClick={() => setSp(new URLSearchParams(p.query))}>★ {p.name}</button>)}</div>}

      {open && <div className="filters">
        <div className="frow">
          <label>Sort<select value={f.sort || 'popularity.desc'} onChange={e => set({ sort: e.target.value })}>{SORTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <label>Original language<select value={f.lang || ''} onChange={e => set({ lang: e.target.value })}><option value="">Any</option>
            {prefs.contentLanguages.length > 0 && <option value={prefs.contentLanguages.join('|')}>My languages</option>}
            {LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
          <label>Country of origin<select value={f.country || ''} onChange={e => set({ country: e.target.value })}><option value="">Any</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
          <label>Year from<input type="number" min="1900" max="2100" value={f.from || ''} onChange={e => set({ from: e.target.value })} placeholder="1900" /></label>
          <label>Year to<input type="number" min="1900" max="2100" value={f.to || ''} onChange={e => set({ to: e.target.value })} placeholder={new Date().getFullYear()} /></label>
          <label>Min rating: {f.rating || 0}<input type="range" min="0" max="9" step="0.5" value={f.rating || 0} onChange={e => set({ rating: e.target.value === '0' ? '' : e.target.value })} /></label>
          <label>Min votes<input type="number" min="0" value={f.votes || ''} onChange={e => set({ votes: e.target.value })} placeholder="10" /></label>
          <label>Runtime (min)<span className="pair"><input type="number" min="0" value={f.rmin || ''} onChange={e => set({ rmin: e.target.value })} placeholder="0" /><input type="number" min="0" value={f.rmax || ''} onChange={e => set({ rmax: e.target.value })} placeholder="400" /></span></label>
          {type === 'movie' && region && <label>Max age rating ({region})<input value={f.cert || ''} onChange={e => set({ cert: e.target.value })} placeholder="e.g. PG-13, U/A, 12" /></label>}
          <label className="check"><input type="checkbox" checked={!!f.free} onChange={e => set({ free: e.target.checked ? '1' : '' })} /> Free to watch (with ads)</label>
          {prefs.services.length > 0 && <label className="check"><input type="checkbox" checked={!!f.mine} onChange={e => set({ mine: e.target.checked ? '1' : '', providers: '' })} /> Only my services</label>}
        </div>
        {genres.data && <><div className="lbl2">Genres (click to include, right-click to exclude)</div><div className="chips">{genres.data.map(g => {
          const ex = (f.exclude || '').split(',').includes(String(g.id));
          return <button key={g.id} className={`chip ${selGenres.includes(String(g.id)) ? 'on' : ''} ${ex ? 'ex' : ''}`} onClick={() => toggleGenre(g.id)}
            onContextMenu={e => { e.preventDefault(); const s = new Set((f.exclude || '').split(',').filter(Boolean)); s.has(String(g.id)) ? s.delete(String(g.id)) : s.add(String(g.id)); set({ exclude: [...s].join(',') }); }}>{g.name}</button>;
        })}</div></>}
        {providers.data?.length > 0 && <><div className="lbl2">Available on ({region})</div><div className="chips prov">{providers.data.map(p => (
          <button key={p.provider_id} title={p.provider_name} className={`chip logo ${selProv.includes(String(p.provider_id)) ? 'on' : ''}`} onClick={() => toggleProv(p.provider_id)}>
            <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt="" />{p.provider_name}</button>))}</div></>}
        <div className="frow end"><button className="btn ghost" onClick={() => setSp({}, { replace: true })}>Reset</button><button className="btn" onClick={savePreset}>Save filter</button></div>
      </div>}

      <Grid items={items} />
      {loading && <p className="muted center">Loading…</p>}
      {!loading && items.length < total && <div className="center"><button className="btn primary" onClick={() => setPage(p => p + 1)}>Load more</button></div>}
      {!loading && total === 0 && <p className="muted center">Nothing matches these filters.</p>}
    </div>
  );
}
