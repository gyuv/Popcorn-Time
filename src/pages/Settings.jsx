import { useStore, useAsync, DEFAULT_PREFS } from '../lib/store.jsx';
import { tmdb } from '../lib/tmdb.js';
import { COUNTRIES, LANGUAGES, ACCENTS } from '../lib/constants.js';

const ROWS = { continue: 'Recently viewed', preferred: 'My languages & country', services: 'My streaming services', trending: 'Trending', movies: 'Popular movies', tv: 'Popular series', anime: 'Anime', upcoming: 'Coming soon' };

export default function Settings() {
  const st = useStore(); const p = st.prefs; const set = st.setPrefs;
  const provs = useAsync(() => (p.country ? tmdb('/watch/providers/movie', { watch_region: p.country }).then(r => r.results.sort((a, b) => a.display_priorities?.[p.country] - b.display_priorities?.[p.country]).slice(0, 48)) : Promise.resolve([])), [p.country]);
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const exportData = () => {
    const { token, ...rest } = st; // never export the API key
    const data = { prefs: rest.prefs, watchlist: rest.watchlist, watched: rest.watched, ratings: rest.ratings, history: rest.history };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'popcorn-time-backup.json'; a.click();
  };
  const importData = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { st.importData(JSON.parse(t)); alert('Imported!'); } catch { alert('Not a valid backup file.'); } }); };

  return (
    <div className="page settings">
      <h1>Settings</h1>

      <section className="panel"><h2>Region &amp; language</h2>
        <p className="muted">Your home page puts titles from your country and languages first.</p>
        <div className="frow">
          <label>Country<select value={p.country} onChange={e => set({ country: e.target.value, services: [] })}><option value="">— Worldwide —</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
          <label>Show titles &amp; descriptions in<select value={p.uiLocale} onChange={e => set({ uiLocale: e.target.value })}>{LANGUAGES.map(([c, n, loc]) => <option key={c} value={loc}>{n}</option>)}</select></label>
        </div>
        <div className="lbl2">Languages I watch (in order of preference)</div>
        <div className="chips">{LANGUAGES.map(([c, n]) => { const i = p.contentLanguages.indexOf(c); return <button key={c} className={`chip ${i >= 0 ? 'on' : ''}`} onClick={() => set({ contentLanguages: toggle(p.contentLanguages, c) })}>{i >= 0 ? `${i + 1}. ` : ''}{n}</button>; })}</div>
      </section>

      <section className="panel"><h2>My streaming services</h2>
        {!p.country ? <p className="muted">Pick a country first.</p> :
          <div className="chips prov">{(provs.data || []).map(x => <button key={x.provider_id} className={`chip logo ${p.services.includes(x.provider_id) ? 'on' : ''}`} onClick={() => set({ services: toggle(p.services, x.provider_id) })}>
            <img src={`https://image.tmdb.org/t/p/w45${x.logo_path}`} alt="" />{x.provider_name}</button>)}</div>}
      </section>

      <section className="panel"><h2>Home page rows</h2>
        <div className="chips">{Object.entries(ROWS).map(([k, n]) => <button key={k} className={`chip ${p.homeRows[k] ? 'on' : ''}`} onClick={() => set({ homeRows: { ...p.homeRows, [k]: !p.homeRows[k] } })}>{n}</button>)}</div>
      </section>

      <section className="panel"><h2>Content filters</h2>
        <div className="frow">
          <label className="check"><input type="checkbox" checked={p.hideAdult} onChange={e => set({ hideAdult: e.target.checked })} /> Hide adult content</label>
          <label className="check"><input type="checkbox" checked={p.hideWatched} onChange={e => set({ hideWatched: e.target.checked })} /> Hide titles I've watched</label>
          <label>Hide titles rated below: {p.minRating}<input type="range" min="0" max="8" step="0.5" value={p.minRating} onChange={e => set({ minRating: +e.target.value })} /></label>
        </div>
        {p.savedFilters.length > 0 && <><div className="lbl2">Saved filters</div><div className="chips">{p.savedFilters.map((f, i) => <button key={i} className="chip" onClick={() => set({ savedFilters: p.savedFilters.filter((_, j) => j !== i) })}>{f.name} ({f.kind}) ✕</button>)}</div></>}
      </section>

      <section className="panel"><h2>Appearance</h2>
        <div className="frow">
          <label>Theme<select value={p.theme} onChange={e => set({ theme: e.target.value })}><option value="dark">Midnight</option><option value="oled">OLED black</option><option value="light">Light</option></select></label>
          <label>Card size<select value={p.cardSize} onChange={e => set({ cardSize: e.target.value })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large (TV)</option></select></label>
        </div>
        <div className="chips">{Object.entries(ACCENTS).map(([k, v]) => <button key={k} className={`chip swatch ${p.accent === k ? 'on' : ''}`} style={{ background: `linear-gradient(135deg, ${v.a}, ${v.b})` }} onClick={() => set({ accent: k })}>{k}</button>)}</div>
      </section>

      <section className="panel"><h2>Data</h2>
        <div className="frow">
          <button className="btn" onClick={exportData}>Export backup</button>
          <label className="btn">Import backup<input type="file" accept="application/json" hidden onChange={importData} /></label>
          <button className="btn ghost" onClick={() => set({ ...DEFAULT_PREFS, homeRows: DEFAULT_PREFS.homeRows })}>Reset settings</button>
          <button className="btn ghost" onClick={() => { const t = prompt('New TMDB API key'); if (t) st.setToken(t.trim()); }}>Change TMDB key</button>
          <button className="btn danger" onClick={() => confirm('Erase all data on this device?') && st.reset()}>Erase everything</button>
        </div>
      </section>
      <p className="muted small">Popcorn Time v1.0.0 · All data stays on this device.</p>
    </div>
  );
}
