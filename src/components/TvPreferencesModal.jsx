import { useState } from "react";
import { CloseIcon, CheckIcon } from "./Icons";
import { storage, STORAGE_KEYS } from "../utils/storage";
import {
  TV_THEME_PRESETS,
  PREFERRED_LANGUAGES,
  loadTvPrefs,
  saveTvPrefs,
  applyTvThemePreset,
} from "../utils/tvPrefs";

const ROW_LABELS = [
  { id: "continue", label: "Continue Watching" },
  { id: "favoriteShows", label: "Favorite TV Shows" },
  { id: "upcomingReleases", label: "Upcoming Episodes" },
  { id: "trendingMovies", label: "Trending Movies" },
  { id: "trendingTV", label: "Trending Series" },
  { id: "anime", label: "Anime Spotlight" },
  { id: "topRated", label: "Top Rated" },
  { id: "recommended", label: "Recommended for You" },
];

export default function TvPreferencesModal({ onClose }) {
  const [prefs, setPrefs] = useState(loadTvPrefs);
  const [autoplayEnabled, setAutoplayEnabled] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_ENABLED) ?? true,
  );
  const [autoplayDuration, setAutoplayDuration] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_DURATION) ?? 5,
  );
  const [introSkipMode, setIntroSkipMode] = useState(
    () => storage.get(STORAGE_KEYS.INTRO_SKIP_MODE) || "off",
  );

  const toggleAutoplayEnabled = () => {
    const next = !autoplayEnabled;
    setAutoplayEnabled(next);
    storage.set(STORAGE_KEYS.AUTOPLAY_NEXT_ENABLED, next);
  };

  const cycleAutoplayDuration = () => {
    const cycle = [5, 10, 0];
    const next = cycle[(cycle.indexOf(autoplayDuration) + 1) % cycle.length];
    setAutoplayDuration(next);
    storage.set(STORAGE_KEYS.AUTOPLAY_NEXT_DURATION, next);
  };

  const setIntroMode = (mode) => {
    setIntroSkipMode(mode);
    storage.set(STORAGE_KEYS.INTRO_SKIP_MODE, mode);
    window.dispatchEvent(new CustomEvent("popcorntime:tv-prefs-changed", { detail: prefs }));
  };

  const updatePrefs = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveTvPrefs(next);
    if (patch.themePreset) applyTvThemePreset(patch.themePreset);
  };

  const toggleRow = (id) => {
    const nextRows = { ...prefs.showRows, [id]: !prefs.showRows[id] };
    updatePrefs({ showRows: nextRows });
  };

  const toggleLanguage = (code) => {
    const cur = prefs.preferredLanguages || [];
    const next = cur.includes(code)
      ? cur.filter((c) => c !== code)
      : [...cur, code];
    updatePrefs({ preferredLanguages: next });
  };

  const selectedLangs = prefs.preferredLanguages || [];

  return (
    <div
      className="modal-overlay tv-prefs-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="tv-prefs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-prefs-header">
          <div>
            <div className="tv-prefs-title">TV Experience & Preferences</div>
            <div className="tv-prefs-sub">
              Customize dark theme, card layout, preferred languages, and home shelves
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            data-gamepad-close="1"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="tv-prefs-body">
          {/* Theme Presets */}
          <div className="tv-prefs-section">
            <div className="tv-prefs-label">Dark Environment Theme</div>
            <div className="tv-prefs-grid">
              {TV_THEME_PRESETS.map((p) => {
                const active = prefs.themePreset === p.id;
                return (
                  <button
                    key={p.id}
                    className={`tv-pref-chip${active ? " tv-pref-chip--active" : ""}`}
                    onClick={() => updatePrefs({ themePreset: p.id })}
                  >
                    <span
                      className="tv-pref-swatch"
                      style={{
                        background: p.bg,
                        borderColor: p.accentHex,
                        boxShadow: `inset 0 0 0 4px ${p.accentHex}`,
                      }}
                    />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Layout */}
          <div className="tv-prefs-section">
            <div className="tv-prefs-label">Card Layout</div>
            <div className="tv-prefs-two-col">
              <button
                className={`tv-pref-chip${prefs.cardStyle === "poster" ? " tv-pref-chip--active" : ""}`}
                onClick={() => updatePrefs({ cardStyle: "poster" })}
              >
                {prefs.cardStyle === "poster" && <CheckIcon size={13} />}
                <span>Poster Cards (2:3)</span>
              </button>
              <button
                className={`tv-pref-chip${prefs.cardStyle === "landscape" ? " tv-pref-chip--active" : ""}`}
                onClick={() => updatePrefs({ cardStyle: "landscape" })}
              >
                {prefs.cardStyle === "landscape" && <CheckIcon size={13} />}
                <span>Cinema Backdrop (16:9)</span>
              </button>
            </div>
          </div>

          {/* Playback & Spotlight */}
          <div className="tv-prefs-section">
            <div className="tv-prefs-label">Playback & Spotlight</div>
            <div className="tv-prefs-two-col">
              <button
                className={`tv-pref-chip${prefs.autoFullscreen ? " tv-pref-chip--active" : ""}`}
                onClick={() =>
                  updatePrefs({ autoFullscreen: !prefs.autoFullscreen })
                }
              >
                Auto Fullscreen on Play: {prefs.autoFullscreen ? "ON" : "OFF"}
              </button>
              <button
                className={`tv-pref-chip${prefs.heroAutoCycle ? " tv-pref-chip--active" : ""}`}
                onClick={() =>
                  updatePrefs({ heroAutoCycle: !prefs.heroAutoCycle })
                }
              >
                Spotlight Auto-Cycle: {prefs.heroAutoCycle ? "ON" : "OFF"}
              </button>
              <button
                className={`tv-pref-chip${autoplayEnabled ? " tv-pref-chip--active" : ""}`}
                onClick={toggleAutoplayEnabled}
              >
                Auto-Play Next Episode: {autoplayEnabled ? "ON" : "OFF"}
              </button>
              <button
                className={`tv-pref-chip${autoplayEnabled ? " tv-pref-chip--active" : ""}`}
                onClick={cycleAutoplayDuration}
              >
                Up Next Timer: {autoplayDuration === 0 ? "Manual" : `${autoplayDuration}s`}
              </button>
            </div>
            <div className="tv-prefs-row" style={{ marginTop: 4 }}>
              {[
                { id: "off", label: "Intro Skip: Off" },
                { id: "auto", label: "Intro Skip: Auto" },
                { id: "manual", label: "Intro Skip: Button" },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`tv-pref-chip${introSkipMode === m.id ? " tv-pref-chip--active" : ""}`}
                  onClick={() => setIntroMode(m.id)}
                >
                  {introSkipMode === m.id && <CheckIcon size={13} />}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Content Languages (Multi-select) */}
          <div className="tv-prefs-section">
            <div className="tv-prefs-label">
              Preferred Content Languages (Multi-Select — Filters Home Titles & Posters)
            </div>
            <div className="tv-prefs-row">
              <button
                className={`tv-pref-chip${selectedLangs.length === 0 ? " tv-pref-chip--active" : ""}`}
                onClick={() => updatePrefs({ preferredLanguages: [] })}
              >
                {selectedLangs.length === 0 && <CheckIcon size={13} />}
                <span>All Languages</span>
              </button>
              {PREFERRED_LANGUAGES.map((lang) => {
                const active = selectedLangs.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    className={`tv-pref-chip${active ? " tv-pref-chip--active" : ""}`}
                    onClick={() => toggleLanguage(lang.code)}
                  >
                    {active && <CheckIcon size={13} />}
                    <span>{lang.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Home Shelves Visibility */}
          <div className="tv-prefs-section">
            <div className="tv-prefs-label">Home Shelves</div>
            <div className="tv-prefs-row">
              {ROW_LABELS.map((r) => (
                <button
                  key={r.id}
                  className={`tv-pref-chip${prefs.showRows[r.id] ? " tv-pref-chip--active" : ""}`}
                  onClick={() => toggleRow(r.id)}
                >
                  {prefs.showRows[r.id] && <CheckIcon size={13} />}
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tv-prefs-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
