// Thin TMDB client. Accepts either a v4 "API Read Access Token" (JWT) or a v3 API key.
import { getToken } from './store.jsx';

const BASE = 'https://api.themoviedb.org/3';
export const IMG = (path, size = 'w342') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : '');
const cache = new Map();

export async function tmdb(path, params = {}, token = getToken()) {
  if (!token) throw new Error('NO_TOKEN');
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
  const isV3Key = /^[a-f0-9]{32}$/i.test(token);
  if (isV3Key) q.set('api_key', token);
  const url = `${BASE}${path}?${q}`;
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { headers: isV3Key ? {} : { Authorization: `Bearer ${token}` } }).then(async r => {
    if (!r.ok) { cache.delete(url); throw new Error(r.status === 401 ? 'BAD_TOKEN' : `TMDB ${r.status}`); }
    return r.json();
  });
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

export const validateToken = token => tmdb('/configuration', {}, token).then(() => true);

// Normalise movie/tv results into one shape the UI can render.
export function norm(item, fallbackType) {
  const type = item.media_type || fallbackType || (item.first_air_date !== undefined ? 'tv' : 'movie');
  return {
    id: item.id, type,
    title: item.title || item.name || '',
    date: item.release_date || item.first_air_date || '',
    poster: item.poster_path, backdrop: item.backdrop_path,
    rating: item.vote_average || 0, overview: item.overview || '',
    genres: item.genre_ids || (item.genres || []).map(g => g.id),
    lang: item.original_language,
  };
}
export const year = d => (d ? d.slice(0, 4) : '');

export const isAnime = item => item.lang === 'ja' && item.genres?.includes(16);
