import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { validateToken } from '../lib/tmdb.js';
import { COUNTRIES, LANGUAGES } from '../lib/constants.js';

export default function Setup() {
  const { setToken, setPrefs, prefs } = useStore();
  const [tok, setTok] = useState('');
  const [country, setCountry] = useState(prefs.country || guessCountry());
  const [langs, setLangs] = useState(prefs.contentLanguages);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await validateToken(tok.trim());
      const ui = LANGUAGES.find(l => l[0] === langs[0])?.[2] || 'en-US';
      setPrefs({ country, contentLanguages: langs, uiLocale: prefs.uiLocale === 'en-US' ? ui : prefs.uiLocale });
      setToken(tok.trim());
    } catch { setErr('That key was rejected by TMDB. Paste the "API Read Access Token" or the v3 API key.'); }
    setBusy(false);
  }
  const toggle = c => setLangs(l => (l.includes(c) ? l.filter(x => x !== c) : [...l, c]));

  return (
    <div className="setup">
      <form className="setupcard" onSubmit={go}>
        <img src="icons/logo.png" className="setuplogo" alt="Popcorn Time" />
        <h1>Popcorn<b>Time</b></h1>
        <p className="muted">Discover movies, series and anime, see where to watch them, and keep your own library.</p>
        <label>TMDB API key
          <input value={tok} onChange={e => setTok(e.target.value)} placeholder="eyJhbGciOi… or 32-char v3 key" required autoFocus />
        </label>
        <p className="hint">Free at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">themoviedb.org → Settings → API</a>. Stored only on this device.</p>
        <label>Your country
          <select value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">— Worldwide —</option>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
        <div className="lbl2">Languages you like to watch</div>
        <div className="chips">{LANGUAGES.map(([c, n]) => <button type="button" key={c} className={`chip ${langs.includes(c) ? 'on' : ''}`} onClick={() => toggle(c)}>{n}</button>)}</div>
        {err && <p className="err">{err}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Checking…' : 'Start watching'}</button>
      </form>
    </div>
  );
}
function guessCountry() {
  const m = (navigator.language || '').match(/-([A-Z]{2})$/);
  return m && COUNTRIES.some(c => c[0] === m[1]) ? m[1] : '';
}
