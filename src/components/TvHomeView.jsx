import { useState, useEffect, useMemo } from "react";
import MediaCard from "./MediaCard";
import {
  PlayIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  SlidersIcon,
  WifiOffIcon,
  CheckIcon,
  CloseIcon,
} from "./Icons";
import { imgUrl, tmdbFetch } from "../utils/api";
import {
  loadUpcomingForShows,
  formatAirCountdown,
} from "../utils/upcomingEpisodes";
import {
  PREFERRED_LANGUAGES,
  loadTvPrefs,
  saveTvPrefs,
} from "../utils/tvPrefs";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "Series" },
  { id: "anime", label: "Anime" },
];

const GENRES = [
  { id: "all", label: "All Genres" },
  { id: "28", label: "Action", tvId: "10759" },
  { id: "12", label: "Adventure", tvId: "10759" },
  { id: "16", label: "Animation" },
  { id: "35", label: "Comedy" },
  { id: "80", label: "Crime" },
  { id: "18", label: "Drama" },
  { id: "14", label: "Fantasy", tvId: "10765" },
  { id: "27", label: "Horror" },
  { id: "9648", label: "Mystery" },
  { id: "878", label: "Sci-Fi", tvId: "10765" },
  { id: "53", label: "Thriller" },
];

const SORTS = [
  { id: "popularity.desc", label: "Popular" },
  { id: "vote_average.desc", label: "Top Rated" },
  {
    id: "primary_release_date.desc",
    tvSort: "first_air_date.desc",
    label: "Newest",
  },
];

const RATINGS = [
  { value: 0, label: "All ★" },
  { value: 6, label: "6.0+" },
  { value: 7, label: "7.0+" },
  { value: 8, label: "8.0+" },
];

export default function TvHomeView({
  trending,
  trendingTV,
  loading,
  offline,
  onRetry,
  onSelect,
  progress,
  inProgress,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  recommendedItems,
  topRatedItems,
  ratingsMap,
  getRating,
  itemRestricted,
  saved,
  favorites,
  apiKey,
  onOpenPrefs,
}) {
  const [prefs, setPrefs] = useState(loadTvPrefs);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [animeItems, setAnimeItems] = useState([]);
  const [favoriteShowsEnriched, setFavoriteShowsEnriched] = useState([]);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [langMovies, setLangMovies] = useState(null);
  const [langTV, setLangTV] = useState(null);
  const [langTopRated, setLangTopRated] = useState(null);
  const [discoverItems, setDiscoverItems] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  useEffect(() => {
    const handler = (e) => setPrefs(e.detail || loadTvPrefs());
    window.addEventListener("popcorntime:tv-prefs-changed", handler);
    return () =>
      window.removeEventListener("popcorntime:tv-prefs-changed", handler);
  }, []);

  const setFilter = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveTvPrefs(next);
  };

  const toggleLanguage = (code) => {
    const cur = prefs.preferredLanguages || [];
    const next = cur.includes(code)
      ? cur.filter((c) => c !== code)
      : [...cur, code];
    setFilter({ preferredLanguages: next });
  };

  const selectedLangs = prefs.preferredLanguages || [];
  const langQueryParam =
    selectedLangs.length > 0
      ? `&with_original_language=${selectedLangs.join("|")}`
      : "";

  // When preferred languages are selected, fetch language-specific Home shelves & Hero
  useEffect(() => {
    if (!apiKey || offline) return;
    if (selectedLangs.length === 0) {
      setLangMovies(null);
      setLangTV(null);
      setLangTopRated(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      tmdbFetch(
        `/discover/movie?sort_by=popularity.desc&vote_count.gte=20${langQueryParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "movie" }))),
      tmdbFetch(
        `/discover/tv?sort_by=popularity.desc&vote_count.gte=15${langQueryParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "tv" }))),
      tmdbFetch(
        `/discover/movie?sort_by=vote_average.desc&vote_count.gte=100${langQueryParam}&page=1`,
        apiKey,
      ).then((d) => (d.results || []).map((i) => ({ ...i, media_type: "movie" }))),
    ])
      .then(([movies, tv, topM]) => {
        if (cancelled) return;
        setLangMovies(movies);
        setLangTV(tv);
        setLangTopRated(topM);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiKey, offline, langQueryParam, selectedLangs.length]);

  const effectiveMovies = useMemo(
    () =>
      langMovies ??
      trending.slice(0, 14).map((i) => ({ ...i, media_type: "movie" })),
    [langMovies, trending],
  );
  const effectiveTV = useMemo(
    () =>
      langTV ??
      trendingTV.slice(0, 14).map((i) => ({ ...i, media_type: "tv" })),
    [langTV, trendingTV],
  );
  const effectiveTopRated = useMemo(
    () => langTopRated ?? topRatedItems,
    [langTopRated, topRatedItems],
  );

  // Spotlight slides: interleave top 3 trending/preferred movies + top 2 series
  const heroSlides = useMemo(() => {
    const m = effectiveMovies.slice(0, 3);
    const t = effectiveTV.slice(0, 2);
    const out = [];
    for (let i = 0; i < 3; i++) {
      if (m[i]) out.push(m[i]);
      if (t[i]) out.push(t[i]);
    }
    return out.filter((x) => x.backdrop_path);
  }, [effectiveMovies, effectiveTV]);

  useEffect(() => {
    if (!prefs.heroAutoCycle || heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroSlides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [prefs.heroAutoCycle, heroSlides.length]);

  const activeHero =
    heroSlides[heroIdx % Math.max(1, heroSlides.length)] || effectiveMovies[0];

  // Fetch Anime Spotlight shelf
  useEffect(() => {
    if (!apiKey || offline) return;
    let cancelled = false;
    tmdbFetch(
      "/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1",
      apiKey,
    )
      .then((data) => {
        if (cancelled) return;
        setAnimeItems(
          (data.results || []).slice(0, 14).map((i) => ({
            ...i,
            media_type: "tv",
            original_language: i.original_language || "ja",
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiKey, offline]);

  // Fetch Favorite TV Shows schedule & Upcoming Releases (personalized favorites + airing soon)
  useEffect(() => {
    if (!apiKey || offline) return;
    let cancelled = false;
    const favTvs = (favorites || []).filter(
      (f) => (f.media_type || (f.first_air_date ? "tv" : "movie")) === "tv",
    );
    const savedTvs = (saved || []).filter(
      (s) => (s.media_type || (s.first_air_date ? "tv" : "movie")) === "tv",
    );
    const progTvs = (inProgress || []).filter((p) => p.media_type === "tv");
    const trackedPool = [...favTvs, ...savedTvs, ...progTvs];

    Promise.all([
      loadUpcomingForShows(favTvs, apiKey),
      loadUpcomingForShows(trackedPool, apiKey),
      tmdbFetch(`/tv/on_the_air?page=1${langQueryParam}`, apiKey)
        .then((d) =>
          (d.results || []).slice(0, 10).map((i) => ({
            ...i,
            media_type: "tv",
            _releaseLabel: "Airing Now",
          })),
        )
        .catch(() => []),
      tmdbFetch(`/movie/upcoming?page=1${langQueryParam}`, apiKey)
        .then((d) =>
          (d.results || []).slice(0, 8).map((i) => ({
            ...i,
            media_type: "movie",
            _releaseLabel: i.release_date
              ? formatAirCountdown(i.release_date)?.label || i.release_date
              : "Upcoming",
          })),
        )
        .catch(() => []),
    ])
      .then(([favEnriched, trackedEnriched, onTheAir, upcomingMovies]) => {
        if (cancelled) return;
        const inProgById = new Map(progTvs.map((p) => [p.id, p]));
        setFavoriteShowsEnriched(
          favEnriched.map((show) => {
            const progMatch = inProgById.get(show.id);
            return progMatch
              ? {
                  ...show,
                  season: progMatch.season,
                  episode: progMatch.episode,
                  episodeName: progMatch.episodeName,
                }
              : show;
          }),
        );

        const withNext = trackedEnriched
          .filter((t) => t._nextEp != null)
          .sort(
            (a, b) =>
              (a._daysUntil ?? 9999) - (b._daysUntil ?? 9999),
          );
        const seen = new Set(withNext.map((i) => `tv_${i.id}`));
        const merged = [...withNext];
        for (const item of [...onTheAir, ...upcomingMovies]) {
          const k = `${item.media_type}_${item.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(item);
        }
        setUpcomingItems(merged.slice(0, 16));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [apiKey, offline, favorites, saved, inProgress, langQueryParam]);

  const isFiltered =
    prefs.category !== "all" ||
    prefs.genreId !== "all" ||
    prefs.sortBy !== "popularity.desc" ||
    prefs.minRating > 0;

  // Live TMDB Discover query whenever filters are active (also honors preferredLanguages)
  useEffect(() => {
    if (!apiKey || offline || !isFiltered) {
      setDiscoverItems([]);
      return;
    }
    let cancelled = false;
    setDiscoverLoading(true);

    const genreObj = GENRES.find((g) => g.id === prefs.genreId);
    const sortObj = SORTS.find((s) => s.id === prefs.sortBy) || SORTS[0];
    const minVotes = prefs.sortBy === "vote_average.desc" ? 150 : 25;
    const ratingParam =
      prefs.minRating > 0 ? `&vote_average.gte=${prefs.minRating}` : "";

    const buildMovieQuery = () => {
      const g =
        prefs.category === "anime"
          ? genreObj && genreObj.id !== "all" && genreObj.id !== "16"
            ? `16,${genreObj.id}`
            : "16"
          : genreObj && genreObj.id !== "all"
            ? genreObj.id
            : "";
      const lang =
        prefs.category === "anime"
          ? "&with_original_language=ja"
          : langQueryParam;
      const gParam = g ? `&with_genres=${g}` : "";
      return `/discover/movie?sort_by=${sortObj.id}&vote_count.gte=${minVotes}${ratingParam}${gParam}${lang}&page=1`;
    };

    const buildTvQuery = () => {
      const gId = genreObj ? genreObj.tvId || genreObj.id : "all";
      const g =
        prefs.category === "anime"
          ? gId !== "all" && gId !== "16"
            ? `16,${gId}`
            : "16"
          : gId !== "all"
            ? gId
            : "";
      const lang =
        prefs.category === "anime"
          ? "&with_original_language=ja"
          : langQueryParam;
      const gParam = g ? `&with_genres=${g}` : "";
      const tvSort = sortObj.tvSort || sortObj.id;
      return `/discover/tv?sort_by=${tvSort}&vote_count.gte=${minVotes}${ratingParam}${gParam}${lang}&page=1`;
    };

    const reqs =
      prefs.category === "movie"
        ? [
            tmdbFetch(buildMovieQuery(), apiKey).then((d) =>
              (d.results || []).map((i) => ({ ...i, media_type: "movie" })),
            ),
          ]
        : prefs.category === "tv"
          ? [
              tmdbFetch(buildTvQuery(), apiKey).then((d) =>
                (d.results || []).map((i) => ({ ...i, media_type: "tv" })),
              ),
            ]
          : [
              tmdbFetch(buildMovieQuery(), apiKey).then((d) =>
                (d.results || []).map((i) => ({ ...i, media_type: "movie" })),
              ),
              tmdbFetch(buildTvQuery(), apiKey).then((d) =>
                (d.results || []).map((i) => ({ ...i, media_type: "tv" })),
              ),
            ];

    Promise.all(reqs)
      .then((arrays) => {
        if (cancelled) return;
        const merged = [];
        const max = Math.max(...arrays.map((a) => a.length), 0);
        for (let i = 0; i < max; i++) {
          for (const arr of arrays) if (arr[i]) merged.push(arr[i]);
        }
        setDiscoverItems(
          merged.filter((item) => !itemRestricted(item)).slice(0, 24),
        );
      })
      .catch(() => {
        if (!cancelled) setDiscoverItems([]);
      })
      .finally(() => {
        if (!cancelled) setDiscoverLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiKey,
    offline,
    isFiltered,
    prefs.category,
    prefs.genreId,
    prefs.sortBy,
    prefs.minRating,
    langQueryParam,
    itemRestricted,
  ]);

  const isLandscape = prefs.cardStyle === "landscape";

  const renderShelf = (key, title, items, forceLandscape = false) => {
    if (!items || items.length === 0) return null;
    const useLandscape = forceLandscape || isLandscape;
    const isContinueShelf = key === "continue";
    const leadItem = isContinueShelf ? items[0] : null;
    return (
      <section key={key} className="tv-shelf">
        <div className="tv-shelf-header">
          <div className="tv-shelf-title-row">
            <h2 className="tv-shelf-title">{title}</h2>
            {leadItem && (
              <button
                className="tv-chip tv-chip--resume"
                onClick={() => onSelect({ ...leadItem, autoPlay: true })}
              >
                <PlayIcon size={13} />
                <span>
                  Resume {leadItem.title || leadItem.name}
                  {leadItem.media_type === "tv" && leadItem.season != null
                    ? ` · S${leadItem.season}E${leadItem.episode}`
                    : ""}
                </span>
              </button>
            )}
          </div>
          <span className="tv-shelf-count">{items.length} titles</span>
        </div>
        <div className="tv-shelf-track">
          {items.map((item) => {
            const type = item.media_type === "tv" ? "tv" : "movie";
            const pk =
              type === "movie"
                ? `movie_${item.id}`
                : item.season != null && item.episode != null
                  ? `tv_${item.id}_s${item.season}e${item.episode}`
                  : `tv_${item.id}`;
            const rk = `${type}_${item.id}`;
            const rd = ratingsMap[rk] || {};
            const r = getRating(item);
            return (
              <MediaCard
                key={`${pk}_${item.episode ?? ""}`}
                item={item}
                landscape={useLandscape}
                isContinue={isContinueShelf}
                onClick={() => onSelect(item)}
                progress={progress[pk] || 0}
                watched={watched}
                onMarkWatched={onMarkWatched}
                onMarkUnwatched={onMarkUnwatched}
                ageRating={rd.cert || r.cert}
                restricted={rd.restricted ?? itemRestricted(item)}
              />
            );
          })}
        </div>
      </section>
    );
  };

  if (offline) {
    return (
      <div className="tv-offline fade-in">
        <div className="tv-glass-orb">
          <WifiOffIcon size={40} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          No Internet Connection
        </div>
        <div style={{ fontSize: 14, color: "var(--text3)" }}>
          Check your TV Wi-Fi or Ethernet connection to browse and stream.
        </div>
        <button className="btn btn-primary" onClick={onRetry}>
          Retry Connection
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loader" style={{ minHeight: "75vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const langBadgeLabel =
    selectedLangs.length > 0
      ? selectedLangs
          .map(
            (c) =>
              PREFERRED_LANGUAGES.find((l) => l.code === c)?.label ||
              c.toUpperCase(),
          )
          .join(" · ")
      : null;

  return (
    <div className="tv-home fade-in">
      {/* ── Cinematic Multi-Slide Spotlight Hero ── */}
      {activeHero && !isFiltered && (
        <section className="tv-hero">
          <div
            className="tv-hero-bg"
            style={{
              backgroundImage: `url(${imgUrl(activeHero.backdrop_path, "original")})`,
            }}
          />
          <div className="tv-hero-vignette" />
          <div className="tv-hero-content">
            <div className="tv-hero-badges">
              <span className="tv-hero-pill tv-hero-pill--accent">
                SPOTLIGHT · {activeHero.media_type === "tv" ? "SERIES" : "MOVIE"}
              </span>
              {activeHero.vote_average > 0 && (
                <span className="tv-hero-pill">
                  <StarIcon size={12} /> {activeHero.vote_average.toFixed(1)}
                </span>
              )}
              {(activeHero.release_date || activeHero.first_air_date) && (
                <span className="tv-hero-pill">
                  {(activeHero.release_date || activeHero.first_air_date).slice(
                    0,
                    4,
                  )}
                </span>
              )}
              {activeHero.original_language && (
                <span className="tv-hero-pill">
                  {activeHero.original_language.toUpperCase()}
                </span>
              )}
            </div>

            <h1 className="tv-hero-title">
              {activeHero.title || activeHero.name}
            </h1>
            <p className="tv-hero-overview">{activeHero.overview}</p>

            <div className="tv-hero-actions">
              <button
                className="btn btn-primary tv-cta-btn"
                onClick={() => onSelect({ ...activeHero, autoPlay: true })}
              >
                <PlayIcon /> Watch Now
              </button>
              <button
                className="btn btn-secondary tv-cta-btn"
                onClick={() => onSelect(activeHero)}
              >
                More Info
              </button>
              {heroSlides.length > 1 && (
                <div className="tv-hero-pager">
                  <button
                    className="tv-pager-btn"
                    onClick={() =>
                      setHeroIdx(
                        (i) => (i - 1 + heroSlides.length) % heroSlides.length,
                      )
                    }
                    aria-label="Previous spotlight"
                  >
                    <ChevronLeftIcon size={18} />
                  </button>
                  <button
                    className="tv-pager-btn"
                    onClick={() =>
                      setHeroIdx((i) => (i + 1) % heroSlides.length)
                    }
                    aria-label="Next spotlight"
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Collapsible Filter Toggle Bar ── */}
      <div className="tv-filter-toggle-bar">
        <div className="tv-filter-toggle-left">
          <button
            className={`tv-chip${filtersOpen || isFiltered || selectedLangs.length > 0 ? " tv-chip--active" : ""}`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <FilterIcon size={14} />
            <span>Filters {filtersOpen ? "▴" : "▾"}</span>
            {(isFiltered || selectedLangs.length > 0) && (
              <span className="tv-filter-badge">
                {[
                  prefs.category !== "all" ? prefs.category : null,
                  prefs.genreId !== "all"
                    ? GENRES.find((g) => g.id === prefs.genreId)?.label
                    : null,
                  prefs.sortBy !== "popularity.desc"
                    ? SORTS.find((s) => s.id === prefs.sortBy)?.label
                    : null,
                  prefs.minRating > 0 ? `${prefs.minRating}+ ★` : null,
                  langBadgeLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </button>

          {(isFiltered || selectedLangs.length > 0) && (
            <button
              className="tv-chip tv-chip--reset"
              onClick={() =>
                setFilter({
                  category: "all",
                  genreId: "all",
                  sortBy: "popularity.desc",
                  minRating: 0,
                  preferredLanguages: [],
                })
              }
            >
              <CloseIcon size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        <button className="tv-chip tv-chip--prefs" onClick={onOpenPrefs}>
          <SlidersIcon size={15} />
          <span>Customize UI</span>
        </button>
      </div>

      {/* ── Smart Filter, Multi-Language & Preferences Panel (expanded on click) ── */}
      {filtersOpen && (
        <section className="tv-filter-shell">
          <div className="tv-filter-row">
            <div className="tv-filter-group">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`tv-chip${prefs.category === c.id ? " tv-chip--active" : ""}`}
                  onClick={() => setFilter({ category: c.id })}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="tv-filter-divider" />

            <div className="tv-filter-group">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  className={`tv-chip${prefs.sortBy === s.id ? " tv-chip--active" : ""}`}
                  onClick={() => setFilter({ sortBy: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="tv-filter-divider" />

            <div className="tv-filter-group">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  className={`tv-chip${prefs.minRating === r.value ? " tv-chip--active" : ""}`}
                  onClick={() => setFilter({ minRating: r.value })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-select Content Language Filter */}
          <div className="tv-genre-row">
            <button
              className={`tv-genre-pill${selectedLangs.length === 0 ? " tv-genre-pill--active" : ""}`}
              onClick={() => setFilter({ preferredLanguages: [] })}
            >
              All Languages
            </button>
            {PREFERRED_LANGUAGES.map((lang) => {
              const active = selectedLangs.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  className={`tv-genre-pill${active ? " tv-genre-pill--active" : ""}`}
                  onClick={() => toggleLanguage(lang.code)}
                >
                  {active && <CheckIcon size={12} />}
                  <span>{lang.label}</span>
                </button>
              );
            })}
          </div>

          {/* Genre Filter */}
          <div className="tv-genre-row">
            {GENRES.map((g) => (
              <button
                key={g.id}
                className={`tv-genre-pill${prefs.genreId === g.id ? " tv-genre-pill--active" : ""}`}
                onClick={() => setFilter({ genreId: g.id })}
              >
                {g.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Filtered Discover Grid OR Curated TV Shelves ── */}
      {isFiltered ? (
        <section className="tv-shelf">
          <div className="tv-shelf-header">
            <h2 className="tv-shelf-title">
              Filtered Results
              {prefs.category !== "all"
                ? ` · ${CATEGORIES.find((c) => c.id === prefs.category)?.label}`
                : ""}
              {prefs.genreId !== "all"
                ? ` · ${GENRES.find((g) => g.id === prefs.genreId)?.label}`
                : ""}
              {langBadgeLabel ? ` · ${langBadgeLabel}` : ""}
            </h2>
            {!discoverLoading && (
              <span className="tv-shelf-count">
                {discoverItems.length} titles
              </span>
            )}
          </div>
          {discoverLoading ? (
            <div className="loader" style={{ minHeight: "35vh" }}>
              <div className="spinner" />
            </div>
          ) : discoverItems.length === 0 ? (
            <div className="tv-empty-filter">
              No titles match those filters. Try adding another language, lowering
              the minimum rating, or resetting filters.
            </div>
          ) : (
            <div
              className={`cards-grid${isLandscape ? " cards-grid--landscape" : ""}`}
            >
              {discoverItems.map((item) => {
                const type = item.media_type === "tv" ? "tv" : "movie";
                const rk = `${type}_${item.id}`;
                const rd = ratingsMap[rk] || {};
                return (
                  <MediaCard
                    key={rk}
                    item={item}
                    landscape={isLandscape}
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
          )}
        </section>
      ) : (
        <div className="tv-shelves">
          {prefs.showRows.continue &&
            renderShelf("continue", "Continue Watching", inProgress, true)}
          {prefs.showRows.favoriteShows !== false &&
            favoriteShowsEnriched.length > 0 &&
            renderShelf(
              "favoriteShows",
              "Favorite TV Shows",
              favoriteShowsEnriched,
            )}
          {prefs.showRows.upcomingReleases !== false &&
            renderShelf(
              "upcomingReleases",
              "Upcoming Episodes & Releases",
              upcomingItems,
            )}
          {prefs.showRows.trendingMovies &&
            renderShelf(
              "trendingMovies",
              langBadgeLabel
                ? `Trending Movies · ${langBadgeLabel}`
                : "Trending Movies",
              effectiveMovies.slice(0, 14),
            )}
          {prefs.showRows.trendingTV &&
            renderShelf(
              "trendingTV",
              langBadgeLabel
                ? `Trending Series · ${langBadgeLabel}`
                : "Trending Series",
              effectiveTV.slice(0, 14),
            )}
          {prefs.showRows.anime &&
            renderShelf("anime", "Anime Spotlight", animeItems)}
          {prefs.showRows.recommended &&
            renderShelf("recommended", "Recommended for You", recommendedItems)}
          {prefs.showRows.topRated &&
            renderShelf(
              "topRated",
              langBadgeLabel
                ? `Critically Acclaimed · ${langBadgeLabel}`
                : "Critically Acclaimed",
              effectiveTopRated,
            )}
        </div>
      )}
    </div>
  );
}
