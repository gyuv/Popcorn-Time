import { useState, useEffect, useMemo, useCallback } from "react";
import MediaCard from "../components/MediaCard";
import TrendingCarousel from "../components/TrendingCarousel";
import TvHomeView from "../components/TvHomeView";
import { PlayIcon, StarIcon, WifiOffIcon } from "../components/Icons";
import { imgUrl, tmdbFetch } from "../utils/api";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { storage } from "../utils/storage";
import { loadHomeLayout, loadHomeViewMode } from "../utils/homeLayout";
import { isAndroidTv } from "../utils/platform";
import {
  PREFERRED_LANGUAGES,
  loadTvPrefs,
  saveTvPrefs,
} from "../utils/tvPrefs";

/**
 * Extract up to `count` unique, recently watched items from the user's
 * history (within the last 30 days).  Returns newest-first and dedupes
 * by TMDB id + media_type so we don't fire duplicate API calls.
 */
function getRecentHistoryItems(history, count = 5) {
  if (!history || history.length === 0) return [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = history
    .filter((h) => h.watchedAt && h.watchedAt > thirtyDaysAgo)
    .sort((a, b) => b.watchedAt - a.watchedAt);

  const seen = new Set();
  const unique = [];
  for (const item of recent) {
    const key = `${item.media_type || "movie"}_${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= count) break;
  }
  return unique;
}

export default function HomePage({
  trending,
  trendingTV,
  loading,
  onSelect,
  progress,
  inProgress,
  offline,
  onRetry,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  history,
  saved,
  favorites,
  onToggleFavorite,
  apiKey,
  onOpenPrefs,
}) {
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [topRatedItems, setTopRatedItems] = useState([]);
  const [tvPrefs, setTvPrefs] = useState(loadTvPrefs);
  const [langMovies, setLangMovies] = useState(null);
  const [langTV, setLangTV] = useState(null);
  const [langTopRated, setLangTopRated] = useState(null);
  const [tmdbLangTick, setTmdbLangTick] = useState(0);

  useEffect(() => {
    const onPrefs = (e) => setTvPrefs(e.detail || loadTvPrefs());
    const onMetaLang = () => setTmdbLangTick((t) => t + 1);
    window.addEventListener("popcorntime:tv-prefs-changed", onPrefs);
    window.addEventListener("streambert:tmdb-lang-changed", onMetaLang);
    return () => {
      window.removeEventListener("popcorntime:tv-prefs-changed", onPrefs);
      window.removeEventListener("streambert:tmdb-lang-changed", onMetaLang);
    };
  }, []);

  const selectedLangs = tvPrefs.preferredLanguages || [];
  const togglePrefLang = useCallback((code) => {
    const cur = loadTvPrefs();
    const list = cur.preferredLanguages || [];
    const nextLangs = list.includes(code)
      ? list.filter((c) => c !== code)
      : [...list, code];
    const next = { ...cur, preferredLanguages: nextLangs };
    setTvPrefs(next);
    saveTvPrefs(next);
  }, []);
  const clearPrefLangs = useCallback(() => {
    const cur = loadTvPrefs();
    const next = { ...cur, preferredLanguages: [] };
    setTvPrefs(next);
    saveTvPrefs(next);
  }, []);

  // Load layout config (order + visibility) once on mount
  const [layout] = useState(() => loadHomeLayout());
  const { order: rowOrder, visible: rowVisible } = layout;

  const [viewMode] = useState(() => loadHomeViewMode());

  // Fetch language-specific shelves whenever preferred content languages are active
  useEffect(() => {
    if (!apiKey || offline || selectedLangs.length === 0) {
      setLangMovies(null);
      setLangTV(null);
      setLangTopRated(null);
      return;
    }
    let cancelled = false;
    const langParam = `&with_original_language=${selectedLangs.join("|")}`;
    Promise.all([
      tmdbFetch(
        `/discover/movie?sort_by=popularity.desc&vote_count.gte=20${langParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "movie" }))),
      tmdbFetch(
        `/discover/tv?sort_by=popularity.desc&vote_count.gte=15${langParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "tv" }))),
      tmdbFetch(
        `/discover/movie?sort_by=vote_average.desc&vote_count.gte=100${langParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "movie" }))),
      tmdbFetch(
        `/discover/tv?sort_by=vote_average.desc&vote_count.gte=50${langParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "tv" }))),
    ])
      .then(([movies, tv, topM, topT]) => {
        if (cancelled) return;
        const mergedTop = [];
        const max = Math.max(topM.length, topT.length);
        for (let i = 0; i < Math.min(max, 10); i++) {
          if (topM[i]) mergedTop.push(topM[i]);
          if (topT[i]) mergedTop.push(topT[i]);
        }
        setLangMovies(movies);
        setLangTV(tv);
        setLangTopRated(mergedTop);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiKey, offline, selectedLangs.join("|"), tmdbLangTick]);

  // Stable pre-built item arrays for carousels
  const trendingMovieItems = useMemo(
    () =>
      selectedLangs.length > 0 && langMovies
        ? langMovies.slice(0, 14)
        : trending.slice(0, 10).map((i) => ({ ...i, media_type: "movie" })),
    [selectedLangs.length, langMovies, trending],
  );
  const trendingTVItems = useMemo(
    () =>
      selectedLangs.length > 0 && langTV
        ? langTV.slice(0, 14)
        : trendingTV.slice(0, 10).map((i) => ({ ...i, media_type: "tv" })),
    [selectedLangs.length, langTV, trendingTV],
  );
  const effectiveTopRatedItems = useMemo(
    () =>
      selectedLangs.length > 0 && langTopRated ? langTopRated : topRatedItems,
    [selectedLangs.length, langTopRated, topRatedItems],
  );
  const hero =
    (selectedLangs.length > 0 &&
      (langMovies?.find((m) => m.backdrop_path) || langMovies?.[0])) ||
    trending[0];

  // All items for batch ratings fetch
  const allItems = useMemo(
    () => [
      ...inProgress,
      ...trendingMovieItems,
      ...trendingTVItems,
      ...recommendedItems,
      ...effectiveTopRatedItems,
    ],
    [
      inProgress,
      trendingMovieItems,
      trendingTVItems,
      recommendedItems,
      effectiveTopRatedItems,
    ],
  );

  const { ratingsMap, ageLimitSetting } = useRatings(allItems);

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );
  const itemRestricted = useCallback(
    (item) =>
      isRestricted(getRatingForItem(item, ratingsMap).minAge, ageLimitSetting),
    [ratingsMap, ageLimitSetting],
  );

  // Enrich ratingsMap with restricted flag for carousels
  const enrichedRatingsMap = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(ratingsMap)) {
      out[k] = { ...v, restricted: isRestricted(v.minAge, ageLimitSetting) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingsMap, ageLimitSetting]);

  // Filter recommended items that exceed age limit setting, and prioritize preferred languages
  const filteredRecommendedItems = useMemo(() => {
    const allowed = recommendedItems.filter((item) => !itemRestricted(item));
    if (selectedLangs.length === 0) return allowed;
    const prefSet = new Set(selectedLangs);
    return [...allowed].sort(
      (a, b) =>
        (prefSet.has(b.original_language) ? 1 : 0) -
        (prefSet.has(a.original_language) ? 1 : 0),
    );
  }, [recommendedItems, itemRestricted, selectedLangs]);

  // Fetch personalised recommendations from multiple recent history items
  useEffect(() => {
    if (!apiKey || offline || !history || history.length === 0) return;
    const sources = getRecentHistoryItems(history, 5);
    if (sources.length === 0) return;

    const controller = new AbortController();

    // Build a Set of already-watched TMDB ids for dedup
    const watchedIds = new Set(
      (history || []).map((h) => `${h.media_type || "movie"}_${h.id}`),
    );

    // For each source, try /recommendations first, fall back to /similar
    const fetches = sources.map((source) => {
      const type = source.media_type === "tv" ? "tv" : "movie";
      return tmdbFetch(`/${type}/${source.id}/recommendations`, apiKey, {
        signal: controller.signal,
      })
        .then((data) => {
          const results = (data.results || []).map((i) => ({
            ...i,
            media_type: type,
          }));
          if (results.length > 0) return results;
          // Fall back to /similar if /recommendations returned nothing
          return tmdbFetch(`/${type}/${source.id}/similar`, apiKey, {
            signal: controller.signal,
          }).then((d) =>
            (d.results || []).map((i) => ({ ...i, media_type: type })),
          );
        })
        .catch(() => []);
    });

    Promise.all(fetches)
      .then((arrays) => {
        // Interleave results from each source for variety
        const merged = [];
        const maxLen = Math.max(...arrays.map((a) => a.length));
        for (let i = 0; i < maxLen; i++) {
          for (const arr of arrays) {
            if (arr[i]) merged.push(arr[i]);
          }
        }

        // Deduplicate and filter out already-watched items
        const seen = new Set();
        const deduped = merged.filter((item) => {
          const key = `${item.media_type}_${item.id}`;
          if (seen.has(key) || watchedIds.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRecommendedItems(deduped.slice(0, 20));
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          console.warn("Recommendations fetch failed", e);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, offline, history?.length, tmdbLangTick]);

  // Fetch top rated movies + TV, merge and shuffle
  useEffect(() => {
    if (!apiKey || offline) return;
    const controller = new AbortController();
    Promise.all([
      tmdbFetch("/movie/top_rated?page=1", apiKey, {
        signal: controller.signal,
      }),
      tmdbFetch("/tv/top_rated?page=1", apiKey, { signal: controller.signal }),
    ])
      .then(([moviesData, tvData]) => {
        const movies = (moviesData.results || [])
          .slice(0, 8)
          .map((i) => ({ ...i, media_type: "movie" }));
        const tv = (tvData.results || [])
          .slice(0, 8)
          .map((i) => ({ ...i, media_type: "tv" }));
        // Interleave movies and TV for variety
        const merged = [];
        const max = Math.max(movies.length, tv.length);
        for (let i = 0; i < max; i++) {
          if (movies[i]) merged.push(movies[i]);
          if (tv[i]) merged.push(tv[i]);
        }
        setTopRatedItems(merged);
      })
      .catch((e) => {
        if (e.name !== "AbortError") console.warn("Top rated fetch failed", e);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, offline, tmdbLangTick]);

  if (isAndroidTv()) {
    return (
      <TvHomeView
        trending={trending}
        trendingTV={trendingTV}
        loading={loading}
        offline={offline}
        onRetry={onRetry}
        onSelect={onSelect}
        progress={progress}
        inProgress={inProgress}
        watched={watched}
        onMarkWatched={onMarkWatched}
        onMarkUnwatched={onMarkUnwatched}
        recommendedItems={filteredRecommendedItems}
        topRatedItems={topRatedItems}
        ratingsMap={enrichedRatingsMap}
        getRating={getRating}
        itemRestricted={itemRestricted}
        saved={saved}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        apiKey={apiKey}
        onOpenPrefs={onOpenPrefs}
      />
    );
  }

  return (
    <div className="fade-in">
      {/* ── Offline ── */}
      {offline && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: 16,
            color: "var(--text2)",
          }}
        >
          <div className="tv-glass-orb">
            <WifiOffIcon size={40} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>
            No internet connection
          </div>
          <div style={{ fontSize: 14, color: "var(--text3)" }}>
            Trending and search require an internet connection. Your downloads
            and library still work offline.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}

      {!offline && loading && (
        <div className="loader">
          <div className="spinner" />
        </div>
      )}

      {/* ── Hero (always first) ── */}
      {!loading && hero && (
        <div className="hero">
          <div
            className="hero-bg"
            style={{
              backgroundImage: `url(${imgUrl(hero.backdrop_path, "original")})`,
            }}
          />
          <div className="hero-gradient" />
          <div className="hero-content">
            <div className="hero-type">
              {hero.media_type === "tv" ? "Trending · Series" : "Trending · Movie"}
              {hero.original_language
                ? ` · ${hero.original_language.toUpperCase()}`
                : ""}
            </div>
            <div className="hero-title">{hero.title || hero.name}</div>
            <div className="hero-meta">
              <span className="hero-rating">
                <StarIcon /> {hero.vote_average?.toFixed(1)}
              </span>
              <span>
                {(hero.release_date || hero.first_air_date || "").slice(0, 4)}
              </span>
            </div>
            <div className="hero-overview">{hero.overview}</div>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => onSelect(hero)}
              >
                <PlayIcon /> Watch Now
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onSelect(hero)}
              >
                More Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content Language Quick Filter ── */}
      {!offline && !loading && (
        <div className="home-lang-bar">
          <button
            className={`tv-pref-chip${selectedLangs.length === 0 ? " tv-pref-chip--active" : ""}`}
            onClick={clearPrefLangs}
          >
            {selectedLangs.length === 0 ? "✓ " : ""}All Languages
          </button>
          {PREFERRED_LANGUAGES.map((l) => {
            const active = selectedLangs.includes(l.code);
            return (
              <button
                key={l.code}
                className={`tv-pref-chip${active ? " tv-pref-chip--active" : ""}`}
                onClick={() => togglePrefLang(l.code)}
              >
                {active ? "✓ " : ""}
                {l.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Rows in user-configured order ── */}
      {rowOrder.map((id) => {
        if (!rowVisible[id]) return null;

        if (id === "continue") {
          if (inProgress.length === 0) return null;
          return (
            <div key="continue" className="section">
              <div className="section-title">Continue Watching</div>
              <div className="cards-grid">
                {inProgress.map((item) => {
                  const pk =
                    item.media_type === "movie"
                      ? `movie_${item.id}`
                      : `tv_${item.id}_s${item.season}e${item.episode}`;
                  const r = getRating(item);
                  const restr = itemRestricted(item);
                  return (
                    <MediaCard
                      key={`${item.media_type}_${item.id}`}
                      item={item}
                      isContinue={true}
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
          );
        }

        // Render a section as a flat cards-grid (list view)
        const renderList = (key, title, titleHighlight, items) => {
          if (!items || items.length === 0) return null;
          return (
            <div key={key} className="section">
              <div className="section-title">
                {titleHighlight ? (
                  <>
                    {title}&nbsp;
                    <span style={{ color: "var(--red)" }}>
                      {titleHighlight}
                    </span>
                  </>
                ) : (
                  title
                )}
              </div>
              <div className="cards-grid">
                {items.map((item) => {
                  const type = item.media_type === "tv" ? "tv" : "movie";
                  const rk = `${type}_${item.id}`;
                  const rd = enrichedRatingsMap[rk] || {};
                  return (
                    <MediaCard
                      key={`${item.media_type}_${item.id}`}
                      item={item}
                      onClick={() => onSelect(item)}
                      progress={0}
                      watched={watched}
                      onMarkWatched={onMarkWatched}
                      onMarkUnwatched={onMarkUnwatched}
                      ageRating={rd.cert}
                      restricted={rd.restricted}
                    />
                  );
                })}
              </div>
            </div>
          );
        };

        if (id === "recommended") {
          if (filteredRecommendedItems.length === 0) return null;
          if (viewMode === "list")
            return renderList(
              "recommended",
              "Recommended for You",
              null,
              filteredRecommendedItems,
            );
          return (
            <TrendingCarousel
              key="recommended"
              items={filteredRecommendedItems}
              title="Recommended for You"
              onSelect={onSelect}
              ratingsMap={enrichedRatingsMap}
            />
          );
        }

        if (id === "trendingMovies") {
          if (trendingMovieItems.length === 0) return null;
          if (viewMode === "list")
            return renderList(
              "trendingMovies",
              "Trending Movies",
              null,
              trendingMovieItems,
            );
          return (
            <TrendingCarousel
              key="trendingMovies"
              items={trendingMovieItems}
              title="Trending Movies"
              onSelect={onSelect}
              ratingsMap={enrichedRatingsMap}
            />
          );
        }

        if (id === "trendingTV") {
          if (trendingTVItems.length === 0) return null;
          if (viewMode === "list")
            return renderList(
              "trendingTV",
              "Trending Series",
              null,
              trendingTVItems,
            );
          return (
            <TrendingCarousel
              key="trendingTV"
              items={trendingTVItems}
              title="Trending Series"
              onSelect={onSelect}
              ratingsMap={enrichedRatingsMap}
            />
          );
        }

        if (id === "topRated") {
          if (effectiveTopRatedItems.length === 0) return null;
          if (viewMode === "list")
            return renderList(
              "topRated",
              "Top Rated",
              null,
              effectiveTopRatedItems,
            );
          return (
            <TrendingCarousel
              key="topRated"
              items={effectiveTopRatedItems}
              title="Top Rated"
              onSelect={onSelect}
              ratingsMap={enrichedRatingsMap}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
