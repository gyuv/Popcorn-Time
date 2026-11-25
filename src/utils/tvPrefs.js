import { storage } from "./storage";
import { applyAccentColor, applyTheme } from "./appearance";

export const TV_PREFS_KEY = "tvPrefs";

export const PREFERRED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
];

export const TV_THEME_PRESETS = [
  {
    id: "obsidian",
    name: "Obsidian Cinema",
    accent: "red",
    accentHex: "#e50914",
    bg: "#06070b",
    surface: "#11131b",
    surface2: "#191c28",
  },
  {
    id: "sapphire",
    name: "Midnight Sapphire",
    accent: "blue",
    accentHex: "#3b82f6",
    bg: "#050914",
    surface: "#0d1426",
    surface2: "#141f38",
  },
  {
    id: "emerald",
    name: "Emerald Aurora",
    accent: "green",
    accentHex: "#10b981",
    bg: "#050d0b",
    surface: "#0c1a16",
    surface2: "#132922",
  },
  {
    id: "gold",
    name: "Cinema Gold",
    accent: "amber",
    accentHex: "#f59e0b",
    bg: "#090806",
    surface: "#16130d",
    surface2: "#221d14",
  },
  {
    id: "violet",
    name: "Violet Nebula",
    accent: "purple",
    accentHex: "#8b5cf6",
    bg: "#080612",
    surface: "#131024",
    surface2: "#1d1836",
  },
  {
    id: "oled",
    name: "Pure OLED",
    accent: "red",
    accentHex: "#e50914",
    bg: "#000000",
    surface: "#0b0b0e",
    surface2: "#141419",
  },
];

export const DEFAULT_TV_PREFS = {
  themePreset: "obsidian",
  cardStyle: "poster", // "poster" | "landscape"
  autoFullscreen: true,
  heroAutoCycle: true,
  preferredLanguages: [], // empty = all languages; e.g. ["en", "hi", "ta"]
  showRows: {
    continue: true,
    favoriteShows: true,
    upcomingReleases: true,
    trendingMovies: true,
    trendingTV: true,
    anime: true,
    topRated: true,
    recommended: true,
  },
  category: "all", // "all" | "movie" | "tv" | "anime"
  genreId: "all",
  sortBy: "popularity.desc",
  minRating: 0,
};

export function loadTvPrefs() {
  const saved = storage.get(TV_PREFS_KEY);
  if (!saved || typeof saved !== "object") return { ...DEFAULT_TV_PREFS };
  return {
    ...DEFAULT_TV_PREFS,
    ...saved,
    preferredLanguages: Array.isArray(saved.preferredLanguages)
      ? saved.preferredLanguages
      : [],
    showRows: {
      ...DEFAULT_TV_PREFS.showRows,
      ...(saved.showRows || {}),
    },
  };
}

export function saveTvPrefs(next) {
  storage.set(TV_PREFS_KEY, next);
  window.dispatchEvent(
    new CustomEvent("popcorntime:tv-prefs-changed", { detail: next }),
  );
}

export function applyTvThemePreset(presetId) {
  const preset =
    TV_THEME_PRESETS.find((p) => p.id === presetId) || TV_THEME_PRESETS[0];
  const root = document.documentElement;
  applyTheme("dark");
  applyAccentColor(preset.accent);
  root.style.setProperty("--bg", preset.bg);
  root.style.setProperty("--surface", preset.surface);
  root.style.setProperty("--surface2", preset.surface2);
  root.style.setProperty("--surface3", preset.surface2);
  root.style.setProperty("--accent", preset.accentHex);
  root.style.setProperty("--red", preset.accentHex);
  root.style.setProperty(
    "--red-glow",
    `0 8px 28px color-mix(in srgb, ${preset.accentHex} 38%, transparent)`,
  );
}
