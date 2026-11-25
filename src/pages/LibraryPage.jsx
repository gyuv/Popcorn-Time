import { useCallback, useMemo, useState, useEffect } from "react";
import MediaCard from "../components/MediaCard";
import { imgUrl } from "../utils/api";
import { EyeIcon, WatchedIcon, CalendarIcon, HeartFillIcon, PlayIcon } from "../components/Icons";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { storage, STORAGE_KEYS } from "../utils/storage";
import { loadUpcomingForShows, formatAirCountdown } from "../utils/upcomingEpisodes";

export default function LibraryPage({
  history,
  inProgress,
  saved,
  favorites,
  onToggleFavorite,
  apiKey,
  progress,
  onSelect,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  onRemoveHistory,
}) {
  const [favoriteSchedules, setFavoriteSchedules] = useState([]);
  useEffect(() => {
    const tvFavs = (favorites || []).filter(
      (f) => (f.media_type || (f.first_air_date ? "tv" : "movie")) === "tv",
    );
    if (!apiKey || tvFavs.length === 0) {
      setFavoriteSchedules(tvFavs);
      return;
    }
    let cancelled = false;
    loadUpcomingForShows(tvFavs, apiKey).then((list) => {
      if (!cancelled) setFavoriteSchedules(list);
    });
    return () => {
      cancelled = true;
    };
  }, [favorites, apiKey]);
  const allItems = useMemo(
    () => [...inProgress, ...saved],
    [inProgress, saved],
  );
  const { ratingsMap, ageLimitSetting } = useRatings(allItems);

  const [sort, setSort] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_SORT) || "manual",
  );
  useEffect(() => {
    const handler = (e) => setSort(e.detail);
    window.addEventListener("streambert:library-sort-changed", handler);
    return () =>
      window.removeEventListener("streambert:library-sort-changed", handler);
  }, []);

  const sortLabels = {
    manual: "Custom order",
    title: "A-Z",
    rating: "Top rated",
    year: "Newest first",
  };

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );
  const itemRestricted = useCallback(
    (item) => isRestricted(getRating(item).minAge, ageLimitSetting),
    [getRating, ageLimitSetting],
  );

  return (
    <div className="fade-in">
      <div className="library-header">
        <div className="library-title">My Library</div>
        <div className="library-sub">
          Watch history, progress, and saved titles
        </div>
      </div>

      {inProgress.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">Continue Watching</div>
          <div className="cards-grid">
            {inProgress.map((item, i) => {
              const pk =
                item.media_type === "movie"
                  ? `movie_${item.id}`
                  : `tv_${item.id}_s${item.season}e${item.episode}`;
              const r = getRating(item);
              const restr = itemRestricted(item);
              return (
                <MediaCard
                  key={pk}
                  item={item}
                  onClick={() => onSelect(item)}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={r.cert}
                  restricted={restr}
                />
              );
            })}
          </div>
        </div>
      )}

      {favoriteSchedules.length > 0 && (
        <div className="library-section">
          <div className="library-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HeartFillIcon size={16} /> Favorite TV Shows &amp; Upcoming Episodes ({favoriteSchedules.length})
          </div>
          <div className="library-fav-grid">
            {favoriteSchedules.map((show) => {
              const nextEp = show._nextEp;
              const lastEp = show._lastEp;
              const nextLabel = nextEp
                ? `Next: S${nextEp.season_number}E${nextEp.episode_number}${nextEp.name ? ` · ${nextEp.name}` : ""} — ${formatAirCountdown(nextEp.air_date)?.label || nextEp.air_date}`
                : show._status === "Returning Series"
                  ? "Returning Series · Next air date TBA"
                  : lastEp
                    ? `Last aired: S${lastEp.season_number}E${lastEp.episode_number} (${lastEp.air_date || ""})`
                    : show._status || "TV Series";
              return (
                <div
                  key={`fav_${show.id}`}
                  className="library-fav-card"
                  onClick={() => onSelect(show)}
                >
                  <div className="library-fav-poster">
                    {show.poster_path ? (
                      <img src={imgUrl(show.poster_path, "w185")} alt={show.title || show.name} />
                    ) : null}
                  </div>
                  <div className="library-fav-info">
                    <div className="library-fav-title">{show.title || show.name}</div>
                    <div className="library-fav-schedule">
                      <CalendarIcon size={13} />
                      <span>{nextLabel}</span>
                    </div>
                    <div className="library-fav-actions">
                      <button
                        className="btn btn-primary"
                        style={{ padding: "6px 14px", fontSize: 12.5 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect({ ...show, autoPlay: true });
                        }}
                      >
                        <PlayIcon size={12} /> Watch
                      </button>
                      {onToggleFavorite && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: 12.5 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(show);
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">
            Watchlist ({saved.length})
            {sort !== "manual" && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--text3)",
                  marginLeft: 10,
                }}
              >
                {sortLabels[sort]}
              </span>
            )}
          </div>
          <div className="cards-grid">
            {saved.map((item) => {
              const r = getRating(item);
              const restr = itemRestricted(item);
              return (
                <MediaCard
                  key={`${item.media_type}_${item.id}`}
                  item={item}
                  onClick={() => onSelect(item)}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={r.cert}
                  restricted={restr}
                />
              );
            })}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">Watch History</div>
          <div className="history-rows">
            {history.map((item, i) => {
              const pk =
                item.media_type === "movie"
                  ? `movie_${item.id}`
                  : `tv_${item.id}_s${item.season}e${item.episode}`;
              const isWatched = !!watched?.[pk];
              return (
                <div
                  key={`${pk}_${item.watchedAt}`}
                  className="history-row"
                  onClick={() => onSelect(item)}
                >
                  <div className="history-thumb">
                    {item.poster_path && (
                      <img src={imgUrl(item.poster_path, "w92")} alt="" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {item.title}
                      {isWatched && <WatchedIcon size={16} />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>
                      {item.media_type === "tv" &&
                        item.season != null &&
                        item.episode != null && (
                          <>
                            {`S${item.season}E${item.episode}`}
                            {item.episodeName ? ` · ${item.episodeName}` : ""}
                            {" · "}
                          </>
                        )}
                      {new Date(item.watchedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <span
                    className={`search-result-type ${item.media_type === "tv" ? "type-tv" : "type-movie"}`}
                  >
                    {item.media_type === "tv" ? "Series" : "Movie"}
                  </span>
                  {onRemoveHistory && (
                    <button
                      className="history-remove-btn"
                      title="Remove from history"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveHistory(item);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {history.length === 0 && saved.length === 0 && (
        <div className="empty-state">
          <EyeIcon />
          <h3>Nothing here yet</h3>
          <p>
            Start watching a movie or series and your history will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
