<p align="center"><img src="public/logo.png" width="140" alt="Popcorn-Time"></p>
<h1 align="center">Popcorn-Time</h1>
<p align="center">Cross-platform movie, series, and anime streaming app for Web, Android Mobile, Android TV, Windows, macOS, and Linux.</p>

## Platforms

| Platform | Folder / Command | Output |
|---|---|---|
| **Website Streaming (Web / PWA)** | `npm run build` | `dist/` (auto-deployed to GitHub Pages on `main`) |
| **Android Mobile APK** | `npm run android:mobile:apk` | `android-mobile/app/build/outputs/apk/release/app-release.apk` |
| **Android TV APK** | `npm run android:tv:apk` | `android-tv/app/build/outputs/apk/release/app-release.apk` |
| **Desktop (Electron)** | `npm run dist:mac` / `npm run dist:win` / `npm run dist:linux` | `dist/` |

## Features
- **Website Streaming:** Responsive web player (`iframe` embed streaming) with desktop sidebar, mobile bottom navigation bar, fullscreen toggle, watch progress, library, and built-in/custom TMDB token support.
- **Android Mobile APK (`android-mobile/`):** Touch-friendly native WebView shell (`com.popcorntime.mobile`) with portrait browsing, automatic landscape rotation in fullscreen playback, built-in ad-blocking (`AdBlocker`), HiAnime HLS proxy (`HiAnimeResolver`), subtitle search, and external player support (VLC / MX Player).
- **Android TV APK (`android-tv/`):** 10-foot TV cinema UI (`com.popcorntime.streambert`) with D-pad spatial navigation, remote playback controls, auto-fullscreen, and ad-blocked player WebView.
- **Desktop (Electron):** Offline video downloads (`yt-dlp` / `ffmpeg`), PiP pop-out window, Discord Rich Presence, and scheduled backups.

## Development

```bash
npm install

# Website dev server & production build
npm run web:dev
npm run build
npm run preview

# Build Android APKs (requires Android SDK + JDK 17)
npm run android:mobile:apk
npm run android:tv:apk

# Desktop Electron
npm run start
```
