import { Link } from 'react-router-dom';
import { useStore, useAsync } from '../lib/store.jsx';
import { tmdb, norm, IMG, year } from '../lib/tmdb.js';
import { langName, countryName } from '../lib/constants.js';
import Row from '../components/Row.jsx';

const list = (type) => r => r.results.map(x => norm(x, type));

export default function Home() {
  const { prefs, history } = useStore();
  const L = prefs.uiLocale, C = prefs.country, langs = prefs.contentLanguages, rows = prefs.homeRows;
  const adult = { include_adult: !prefs.hideAdult ? 'true' : 'false' };
  const disc = (type, extra) => () => tmdb(`/discover/${type}`, { language: L, sort_by: 'popularity.desc', 'vote_count.gte': 20, ...adult, ...extra }).then(list(type));
  const today = new Date().toISOString().slice(0, 10);
  const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString().slice(0, 10);

  // Hero: newest popular title in the user's first preferred language (or global trending).
  const hero = useAsync(() => (langs[0]
    ? tmdb('/discover/movie', { language: L, with_original_language: langs[0], sort_by: 'popularity.desc', 'primary_release_date.gte': recent, region: C })
    : tmdb('/trending/all/day', { language: L })
  ).then(r => r.results.map(x => norm(x, 'movie')).filter(x => x.backdrop)), [L, langs.join(), C]);
  const h = hero.data?.[0];

  return (
    <div className="page home">
      {h && (
        <Link to={`/title/${h.type}/${h.id}`} className="hero" style={{ backgroundImage: `url(${IMG(h.backdrop, 'w1280')})` }}>
          <div className="heroin">
            {langs[0] && <span className="pill">New in {langName(langs[0])}</span>}
            <h1>{h.title}</h1>
            <p className="muted">{year(h.date)} · ★ {h.rating.toFixed(1)}</p>
            <p className="ov">{h.overview}</p>
            <span className="btn primary">View details</span>
          </div>
        </Link>
      )}

      {rows.continue && history.length > 0 && <Row title="Recently viewed" items={history} />}

      {rows.preferred && langs.map(lg => (
        <div key={lg}>
          <Row title={`Latest ${langName(lg)} movies`} more={`/browse/movie?lang=${lg}&sort=primary_release_date.desc`} deps={[lg, L, C]}
            load={disc('movie', { with_original_language: lg, 'primary_release_date.lte': today, 'vote_count.gte': 5, sort_by: 'primary_release_date.desc', region: C })} />
          <Row title={`Popular ${langName(lg)} movies`} more={`/browse/movie?lang=${lg}`} deps={[lg, L]} load={disc('movie', { with_original_language: lg })} />
          <Row title={`${langName(lg)} series`} more={`/browse/tv?lang=${lg}`} deps={[lg, L]} load={disc('tv', { with_original_language: lg, 'vote_count.gte': 5 })} />
        </div>
      ))}

      {rows.preferred && C && <>
        <Row title={`Popular in ${countryName(C)}`} deps={[C, L]} more={`/browse/movie?country=${C}`} load={disc('movie', { with_origin_country: C })} />
        <Row title={`Now in cinemas · ${countryName(C)}`} deps={[C, L]} load={() => tmdb('/movie/now_playing', { language: L, region: C }).then(list('movie'))} />
      </>}

      {rows.services && C && prefs.services.length > 0 && <>
        <Row title="On your streaming services · Movies" deps={[C, L, prefs.services.join()]} more="/browse/movie?mine=1"
          load={disc('movie', { watch_region: C, with_watch_providers: prefs.services.join('|'), ...(langs.length ? { with_original_language: langs.join('|') } : {}) })} />
        <Row title="On your streaming services · Series" deps={[C, L, prefs.services.join()]} more="/browse/tv?mine=1"
          load={disc('tv', { watch_region: C, with_watch_providers: prefs.services.join('|'), ...(langs.length ? { with_original_language: langs.join('|') } : {}) })} />
      </>}

      {rows.trending && <Row title="Trending today" deps={[L]} load={() => tmdb('/trending/all/day', { language: L }).then(r => r.results.filter(x => x.media_type !== 'person').map(x => norm(x)))} />}
      {rows.movies && <Row title="Popular movies" deps={[L]} more="/browse/movie" load={disc('movie', {})} />}
      {rows.tv && <Row title="Popular series" deps={[L]} more="/browse/tv" load={disc('tv', {})} />}
      {rows.anime && <Row title="Popular anime" deps={[L]} more="/browse/anime" load={disc('tv', { with_genres: 16, with_original_language: 'ja' })} />}
      {rows.upcoming && <Row title={`Coming soon${C ? ' · ' + countryName(C) : ''}`} deps={[L, C]} load={() => tmdb('/movie/upcoming', { language: L, region: C }).then(list('movie'))} />}

      {!langs.length && !C && <p className="muted tip">Tip: set your country and favourite languages in <Link to="/settings">Settings</Link> to personalise this page.</p>}
    </div>
  );
}
