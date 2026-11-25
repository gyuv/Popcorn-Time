/**
 * Runtime platform detection helpers for Popcorn-Time across:
 * - Web Browser (desktop & mobile web)
 * - Electron Desktop (Windows / macOS / Linux)
 * - Android TV APK (AndroidBridge with deviceType === "tv")
 * - Android Mobile APK (AndroidBridge with deviceType === "mobile")
 */

export function getAndroidDeviceType() {
  if (typeof window === "undefined" || !window.AndroidBridge) return null;
  try {
    const t = window.AndroidBridge.getDeviceType?.();
    if (t === "mobile") return "mobile";
  } catch {}
  return "tv";
}

export function isAndroidApp() {
  return getAndroidDeviceType() !== null;
}

export function isAndroidTv() {
  return getAndroidDeviceType() === "tv";
}

export function isAndroidMobile() {
  return getAndroidDeviceType() === "mobile";
}

export function isElectronDesktop() {
  return (
    typeof window !== "undefined" &&
    !!window.electron &&
    !window.AndroidBridge
  );
}

export function isWebApp() {
  return (
    typeof window !== "undefined" &&
    !window.electron &&
    !window.AndroidBridge
  );
}

export function openExternalUrl(url) {
  if (!url) return;
  if (typeof window !== "undefined" && window.electron?.openExternal) {
    window.electron.openExternal(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
