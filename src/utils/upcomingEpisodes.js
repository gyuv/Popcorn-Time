import { tmdbFetch } from "./api";

const _scheduleCache = new Map(); // id -> { expiresAt, info }
const SCHEDULE_TTL_MS = 20 * 60 * 1000;

export function parseTmdbLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function formatAirCountdown(dateStr) {
  const target = parseTmdbLocalDate(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const shortDate = target.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (diffDays === 0) return { label: "Today", daysUntil: 0, shortDate };
  if (diffDays === 1) return { label: "Tomorrow", daysUntil: 1, shortDate };
  if (diffDays > 1 && diffDays <= 14) {
    return { label: `In ${diffDays}d · ${shortDate}`, daysUntil: diffDays, shortDate };
  }
  if (diffDays > 14) {
    return { label: shortDate, daysUntil: diffDays, shortDate };
  }
  if (diffDays === -1) return { label: "Yesterday", daysUntil: -1, shortDate };
  return { label: `Aired ${shortDate}`, daysUntil: diffDays, shortDate };
}

/**
 * Fetch next_episode_to_air / last_episode_to_air / status for a TV show.
 */
export async function fetchTvScheduleInfo(tvId, apiKey) {
  if (!tvId || !apiKey) return null;
  const key = String(tvId);
  const hit = _scheduleCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.info;

  try {
    const data = await tmdbFetch(`/tv/${tvId}`, apiKey);
    const nextEp = data?.next_episode_to_air || null;
    const lastEp = data?.last_episode_to_air || null;
    const countdown = nextEp?.air_date ? formatAirCountdown(nextEp.air_date) : null;
    const releaseBadge = nextEp
      ? `S${nextEp.season_number}E${nextEp.episode_number} · ${countdown?.label || nextEp.air_date}`
      : data?.status === "Returning Series"
        ? "Returning · TBA"
        : null;
    const info = {
      id: Number(tvId),
      name: data?.name || data?.title || "",
      poster_path: data?.poster_path || null,
      backdrop_path: data?.backdrop_path || null,
      vote_average: data?.vote_average || 0,
      first_air_date: data?.first_air_date || null,
      status: data?.status || "",
      nextEp,
      lastEp,
      daysUntil: countdown?.daysUntil ?? null,
      releaseBadge,
    };
    _scheduleCache.set(key, { expiresAt: Date.now() + SCHEDULE_TTL_MS, info });
    return info;
  } catch {
    return null;
  }
}

/**
 * Batch-load upcoming schedule details for favorite/saved TV shows,
 * sorted soonest upcoming first.
 */
export async function loadUpcomingForShows(shows, apiKey) {
  if (!apiKey || !Array.isArray(shows) || shows.length === 0) return [];
  const tvOnly = shows.filter(
    (s) => (s.media_type || (s.first_air_date ? "tv" : "movie")) === "tv",
  );
  const unique = [];
  const seen = new Set();
  for (const s of tvOnly) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
  }
  const results = await Promise.all(
    unique.slice(0, 18).map(async (show) => {
      const info = await fetchTvScheduleInfo(show.id, apiKey);
      if (!info) return { ...show, media_type: "tv" };
      return {
        ...show,
        media_type: "tv",
        poster_path: show.poster_path || info.poster_path,
        backdrop_path: show.backdrop_path || info.backdrop_path,
        vote_average: show.vote_average || info.vote_average,
        first_air_date: show.first_air_date || info.first_air_date,
        _nextEp: info.nextEp,
        _lastEp: info.lastEp,
        _status: info.status,
        _daysUntil: info.daysUntil,
        _releaseLabel: info.releaseBadge,
      };
    }),
  );
  return results;
}
