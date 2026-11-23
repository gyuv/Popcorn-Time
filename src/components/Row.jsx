import { Link } from 'react-router-dom';
import { useAsync, useStore } from '../lib/store.jsx';
import Card from './Card.jsx';

export function useFiltered(items) {
  const { prefs, watched } = useStore();
  return (items || []).filter(i => i.rating >= (prefs.minRating || 0) || i.rating === 0)
    .filter(i => !(prefs.hideWatched && watched[`${i.type}:${i.id}`]));
}

export default function Row({ title, load, deps = [], more, items: given }) {
  const { loading, data, error } = useAsync(given ? () => Promise.resolve(given) : load, [given, ...deps]);
  const items = useFiltered(data);
  if (!loading && !error && items.length === 0) return null;
  return (
    <section className="row">
      <div className="rowhead"><h2>{title}</h2>{more && <Link className="more" to={more}>See all →</Link>}</div>
      <div className="strip">
        {loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="card skel"><div className="poster" /></div>)}
        {error && <p className="muted">Couldn't load this row ({error.message}).</p>}
        {items.map(i => <Card key={`${i.type}${i.id}`} item={i} />)}
      </div>
    </section>
  );
}
