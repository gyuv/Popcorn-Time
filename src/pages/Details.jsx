import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync, useStore } from '../lib/store.jsx';
import { tmdb, norm, IMG, year } from '../lib/tmdb.js';
import { langName, countryName } from '../lib/constants.js';
import Row from '../components/Row.jsx';
import { useEffect } from 'react';

export default function Details() {
  const { type, id } = useParams();
  const st = useStore();
  const { prefs } = st;
  const { data: d, error } = useAsync(() => tmdb(`/${type}/${id}`, {
    language: prefs.uiLocale,
    append_to_response: `credits,videos,recommendations,similar,watch/providers,${type === 'movie' ? 'release_dates' : 'content_ratings'},external_ids`,
    include_video_language: `${prefs.uiLocale.slice(0, 2)},en,null`,
  }), [type, id, prefs.uiLocale]);
  const [trailer, setTrailer] = useState(null);
  const [season, setSeason] = useState(null);

  const item = d ? norm(d, type) : null;
  useEffect(() => { if (item) st.visit(item); /* eslint-disable-next-line */ }, [d?.id]);
  if (error) return <div className="page err">Couldn't load this title.</div>;
  if (!d) return <div className="page muted">Loading…</div>;

  const k = `${type}:${id}`;
  const C = prefs.country || 'US';
  const wp = d['watch/providers']?.results?.[C];
  const cert = type === 'movie'
    ? d.release_dates?.results?.find(r => r.iso_3166_1 === C)?.release_dates?.find(x => x.certification)?.certification
    : d.content_ratings?.results?.find(r => r.iso_3166_1 === C)?.rating;
  const vids = (d.videos?.results || []).filter(v => v.site === 'YouTube');
  const tr = vids.find(v => v.type === 'Trailer') || vids[0];
  const runtime = d.runtime || d.episode_run_time?.[0];
  const myRating = st.ratings[k]?.value || 0;
  const seasons = (d.seasons || []).filter(s => s.season_number > 0 || d.seasons.length === 1);
  const mine = new Set(prefs.services.map(String));

  return (
    <div className="page details">
      <div className="backdrop" style={{ backgroundImage: `url(${IMG(d.backdrop_path, 'w1280')})` }} />
      <div className="dhead">
        <img className="dposter" src={IMG(d.poster_path, 'w500')} alt="" />
        <div className="dinfo">
          <h1>{item.title}</h1>
          {d.tagline && <p className="tag">{d.tagline}</p>}
          <div className="meta">
            <span>{year(item.date)}</span>{cert && <span className="cert">{cert}</span>}
            {runtime && <span>{Math.floor(runtime / 60) ? `${Math.floor(runtime / 60)}h ` : ''}{runtime % 60}m</span>}
            {type === 'tv' && <span>{d.number_of_seasons} season{d.number_of_seasons > 1 ? 's' : ''}</span>}
            <span>★ {item.rating.toFixed(1)} ({d.vote_count})</span>
            <span>{langName(d.original_language)}</span>
            {d.status && <span>{d.status}</span>}
          </div>
          <div className="chips">{d.genres.map(g => <Link key={g.id} className="chip" to={`/browse/${type}?genres=${g.id}`}>{g.name}</Link>)}</div>
          <p className="ov">{d.overview}</p>
          <div className="actions">
            {tr && <button className="btn primary" onClick={() => setTrailer(tr.key)}>▶ Trailer</button>}
            <button className={`btn ${st.watchlist[k] ? 'on' : ''}`} onClick={() => st.toggleWatchlist(item)}>{st.watchlist[k] ? '♥ In watchlist' : '♡ Watchlist'}</button>
            <button className={`btn ${st.watched[k] ? 'on' : ''}`} onClick={() => st.toggleWatched(item)}>{st.watched[k] ? '✓ Watched' : 'Mark watched'}</button>
            <span className="stars" aria-label="Your rating">{[1, 2, 3, 4, 5].map(n => <button key={n} className={n <= myRating ? 'on' : ''} onClick={() => st.rate(item, n === myRating ? 0 : n)}>★</button>)}</span>
            {navigator.share && <button className="btn ghost" onClick={() => navigator.share({ title: item.title, url: `https://www.themoviedb.org/${type}/${id}` })}>Share</button>}
          </div>

          <div className="where">
            <h3>Where to watch in {countryName(C)}</h3>
            {!wp && <p className="muted">No streaming info for {countryName(C)} yet.</p>}
            {wp && ['flatrate', 'free', 'ads', 'rent', 'buy'].map(kind => wp[kind]?.length ? (
              <div key={kind} className="wrow"><span className="wk">{{ flatrate: 'Stream', free: 'Free', ads: 'Free with ads', rent: 'Rent', buy: 'Buy' }[kind]}</span>
                {[...wp[kind]].sort((a, b) => mine.has(String(b.provider_id)) - mine.has(String(a.provider_id))).map(p => (
                  <a key={p.provider_id} href={wp.link} target="_blank" rel="noreferrer" title={p.provider_name} className={`prov ${mine.has(String(p.provider_id)) ? 'mine' : ''}`}>
                    <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name} /></a>))}
              </div>) : null)}
          </div>
        </div>
      </div>

      {type === 'tv' && seasons.length > 0 && (
        <section className="seasons">
          <h2>Seasons</h2>
          <div className="chips">{seasons.map(s => <button key={s.id} className={`chip ${season === s.season_number ? 'on' : ''}`} onClick={() => setSeason(s.season_number)}>{s.name}</button>)}</div>
          {season !== null && <Episodes tvId={id} season={season} show={item} />}
        </section>
      )}

      {d.credits?.cast?.length > 0 && <section><h2>Cast</h2><div className="strip">{d.credits.cast.slice(0, 20).map(c => (
        <Link key={c.credit_id} to={`/person/${c.id}`} className="person"><img loading="lazy" src={IMG(c.profile_path, 'w185') || 'icons/icon-192.png'} alt="" /><span>{c.name}</span><small className="muted">{c.character}</small></Link>))}</div></section>}

      <Row title="Recommended" items={(d.recommendations?.results || []).map(x => norm(x, type))} />
      <Row title="Similar" items={(d.similar?.results || []).map(x => norm(x, type))} />

      {trailer && <div className="modal" onClick={() => setTrailer(null)}><div className="modalin" onClick={e => e.stopPropagation()}>
        <iframe src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1`} allow="autoplay; fullscreen" allowFullScreen title="Trailer" />
        <button className="btn close" autoFocus onClick={() => setTrailer(null)}>Close ✕</button></div></div>}
    </div>
  );
}

function Episodes({ tvId, season, show }) {
  const st = useStore();
  const { data } = useAsync(() => tmdb(`/tv/${tvId}/season/${season}`, { language: st.prefs.uiLocale }), [tvId, season]);
  if (!data) return <p className="muted">Loading episodes…</p>;
  const key = e => `tv:${tvId}:s${season}e${e.episode_number}`;
  const all = data.episodes.every(e => st.watched[key(e)]);
  return (
    <div className="eps">
      <button className="btn ghost" onClick={() => data.episodes.forEach(e => { if (!!st.watched[key(e)] === all) st.toggleWatched({ ...show, ep: e.episode_number, season }, key(e)); })}>{all ? 'Unmark season' : 'Mark season watched'}</button>
      {data.episodes.map(e => (
        <div key={e.id} className={`ep ${st.watched[key(e)] ? 'seen' : ''}`}>
          {e.still_path ? <img loading="lazy" src={IMG(e.still_path, 'w300')} alt="" /> : <div className="noimg" />}
          <div><b>{e.episode_number}. {e.name}</b><p className="muted small">{e.air_date} · {e.runtime ? `${e.runtime}m` : ''} · ★ {e.vote_average?.toFixed(1)}</p><p className="small">{e.overview}</p></div>
          <button className="btn" onClick={() => st.toggleWatched({ ...show, ep: e.episode_number, season }, key(e))}>{st.watched[key(e)] ? '✓' : 'Watched?'}</button>
        </div>))}
    </div>
  );
}
