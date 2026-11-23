import { useParams } from 'react-router-dom';
import { useAsync, useStore } from '../lib/store.jsx';
import { tmdb, norm, IMG } from '../lib/tmdb.js';
import Grid from '../components/Grid.jsx';
export default function Person() {
  const { id } = useParams(); const { prefs } = useStore();
  const { data } = useAsync(() => tmdb(`/person/${id}`, { language: prefs.uiLocale, append_to_response: 'combined_credits' }), [id]);
  if (!data) return <div className="page muted">Loading…</div>;
  const seen = new Set();
  const works = [...data.combined_credits.cast, ...data.combined_credits.crew].filter(x => !seen.has(x.media_type + x.id) && seen.add(x.media_type + x.id))
    .sort((a, b) => b.popularity - a.popularity).map(x => norm(x));
  return (
    <div className="page">
      <div className="personhead">{data.profile_path && <img src={IMG(data.profile_path, 'w300')} alt="" />}
        <div><h1>{data.name}</h1><p className="muted">{data.known_for_department} · {data.place_of_birth}</p><p className="ov">{data.biography}</p></div></div>
      <h2>Known for</h2><Grid items={works} />
    </div>
  );
}
