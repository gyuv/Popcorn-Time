// Local, private storage for settings and the user's library. Nothing leaves the device.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'popcorntime:v1';
export const DEFAULT_PREFS = {
  uiLocale: 'en-US',            // language for titles/overviews
  country: '',                  // home country -> regional rows & watch providers
  contentLanguages: [],         // preferred original languages -> dedicated home rows
  services: [],                 // streaming provider ids the user subscribes to
  hideAdult: true,
  minRating: 0,
  hideWatched: false,
  accent: 'violet',
  theme: 'dark',                // dark | light | oled
  cardSize: 'md',               // sm | md | lg
  homeRows: { continue: true, preferred: true, services: true, trending: true, movies: true, tv: true, anime: true, upcoming: true },
  savedFilters: [],
};
const empty = { token: '', prefs: DEFAULT_PREFS, watchlist: {}, watched: {}, ratings: {}, progress: {}, history: [] };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...empty, ...s, prefs: { ...DEFAULT_PREFS, ...(s.prefs || {}), homeRows: { ...DEFAULT_PREFS.homeRows, ...(s.prefs?.homeRows || {}) } } };
  } catch { return empty; }
}
let state = load();
export const getToken = () => state.token;

const Ctx = createContext(null);
export function StoreProvider({ children }) {
  const [s, setS] = useState(state);
  const update = useCallback(fn => setS(prev => { const next = fn(prev); state = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} return next; }), []);
  const api = {
    ...s,
    setToken: token => update(p => ({ ...p, token })),
    setPrefs: patch => update(p => ({ ...p, prefs: { ...p.prefs, ...patch } })),
    toggleWatchlist: item => update(p => { const k = `${item.type}:${item.id}`; const w = { ...p.watchlist }; if (w[k]) delete w[k]; else w[k] = { ...item, added: Date.now() }; return { ...p, watchlist: w }; }),
    toggleWatched: (item, key = `${item.type}:${item.id}`) => update(p => { const w = { ...p.watched }; if (w[key]) delete w[key]; else w[key] = { ...item, at: Date.now() }; return { ...p, watched: w }; }),
    rate: (item, value) => update(p => ({ ...p, ratings: { ...p.ratings, [`${item.type}:${item.id}`]: { ...item, value } } })),
    visit: item => update(p => ({ ...p, history: [item, ...p.history.filter(h => !(h.id === item.id && h.type === item.type))].slice(0, 40) })),
    importData: data => update(p => ({ ...p, ...data, prefs: { ...DEFAULT_PREFS, ...(data.prefs || {}) } })),
    reset: () => update(() => empty),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);

export function useAsync(fn, deps) {
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true; setSt(x => ({ ...x, loading: true, error: null }));
    fn().then(data => alive && setSt({ loading: false, data, error: null }), error => alive && setSt({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return st;
}
