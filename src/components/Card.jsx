import { Link } from 'react-router-dom';
import { IMG, year } from '../lib/tmdb.js';
import { useStore } from '../lib/store.jsx';

export default function Card({ item }) {
  const { watchlist, watched } = useStore();
  const k = `${item.type}:${item.id}`;
  return (
    <Link to={`/title/${item.type}/${item.id}`} className="card" title={item.title}>
      <div className="poster">
        {item.poster ? <img loading="lazy" src={IMG(item.poster)} alt="" /> : <div className="noimg">{item.title}</div>}
        {item.rating > 0 && <span className="badge">★ {item.rating.toFixed(1)}</span>}
        {watchlist[k] && <span className="flag wl">♥</span>}
        {watched[k] && <span className="flag seen">✓</span>}
      </div>
      <div className="ct">{item.title}</div>
      <div className="cs">{year(item.date)} · {item.type === 'tv' ? 'Series' : 'Movie'}</div>
    </Link>
  );
}
