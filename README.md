<p align="center"><img src="public/icons/logo.png" width="160" alt="Popcorn Time"></p>
<h1 align="center">Popcorn Time</h1>
<p align="center">Discover movies, series and anime, find out where to watch them legally, and keep your own library on every screen.</p>

## Platforms
| Platform | How |
|---|---|
| **Web app** | `npm run build` → host `dist/` anywhere (auto-deployed to GitHub Pages from `main`) |
| **iOS web app** | Open the web app in Safari → Share → *Add to Home Screen* (full-screen, own icon) |
| **Windows** | `npm run dist:win` → installer + portable `.exe` in `release/` |
| **macOS (Universal: Intel + Apple Silicon)** | `npm run dist:mac` → `.dmg` in `release/` |
| **Android phone/tablet + Android TV** | One APK, `npm run android:apk` (needs Android SDK) or download from CI |

All builds are produced automatically by `.github/workflows/build.yml`. Push a tag like `v1.0.0` to publish a GitHub Release with every installer attached.

## Features
- **Personalised home page:** set your **country** and **favourite languages**, and the home page leads with the latest and most popular movies and series in those languages, what's popular in your country, what's in cinemas there, and what's on *your* streaming services.
- **Advanced filters:** genres (include/exclude), original language, country of origin, year range, rating, vote count, runtime, age rating, streaming service, free-with-ads only, sorting. **Save any filter** as a preset.
- **Where to watch:** stream, free, rent and buy options for your country, with your own services highlighted.
- **Details:** trailers, cast, crew pages, seasons and episodes, recommendations, similar titles.
- **Library:** watchlist, watched (per episode), 5-star ratings, recently viewed. Export and import a backup.
- **My Files:** play your own videos or a direct link from your media server, with .srt/.vtt subtitles, speed control and resume.
- **Customise:** Midnight, OLED or Light theme, 4 brand accent colours, card size, choose which home rows to show, hide adult, watched or low-rated titles.
- **Remote and keyboard friendly:** D-pad navigation for Android TV.
- **Private:** everything is stored on your device. Needs a free [TMDB API key](https://www.themoviedb.org/settings/api).

## Develop
```bash
npm install
npm run dev          # web, hot reload
npm run electron:dev # desktop window
```

---
This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data by JustWatch.
