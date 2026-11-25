// ── Android Bridge ──────────────────────────────────────────────────────────
// Maps window.electron IPC calls to the native AndroidBridge JavascriptInterface
// when running inside the Popcorn-Time Android TV or Mobile WebView shell.

(function initAndroidBridge() {
  if (typeof window === "undefined") return;
  if (window.electron || !window.AndroidBridge) return;

  const bridge = window.AndroidBridge;
  let deviceType = "tv";
  try {
    const dt = bridge.getDeviceType?.();
    if (dt === "mobile") deviceType = "mobile";
  } catch {}

  try {
    document.documentElement.classList.add(
      deviceType === "mobile" ? "android-mobile" : "android-tv",
    );
  } catch {}
  const listeners = new Map(); // channel -> Set<fn>
  const pending = new Map(); // callId -> { resolve, reject }
  let nextCallId = 1;

  function addListener(channel, cb) {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(cb);
    return cb;
  }

  function removeListener(channel, cb) {
    listeners.get(channel)?.delete(cb);
  }

  function invokeAsync(method, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = nextCallId++;
      pending.set(id, { resolve, reject });
      try {
        bridge[method](id, JSON.stringify(payload ?? {}));
      } catch (err) {
        pending.delete(id);
        reject(err);
      }
    });
  }

  // Called by Kotlin when an async call finishes
  window.__androidResolve = (callId, ok, resultJson) => {
    const entry = pending.get(callId);
    if (!entry) return;
    pending.delete(callId);
    try {
      const parsed = resultJson ? JSON.parse(resultJson) : null;
      if (ok) entry.resolve(parsed);
      else entry.reject(new Error(parsed?.error || String(parsed || "Bridge error")));
    } catch (e) {
      if (ok) entry.resolve(resultJson);
      else entry.reject(e);
    }
  };

  // Called by Kotlin for push events (m3u8-found, blocked-stats-update, etc.)
  window.__androidEmit = (channel, payload) => {
    const set = listeners.get(channel);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch {}
    }
  };

  // Player WebView imperative event dispatch (did-finish-load, did-fail-load, dom-ready, will-navigate)
  const playerListeners = new Map(); // event -> Set<fn>
  window.__androidPlayerEvent = (eventName, payload) => {
    const set = playerListeners.get(eventName);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(payload || {});
      } catch {}
    }
  };
  window.__androidPlayerListeners = {
    add(evt, fn) {
      if (!playerListeners.has(evt)) playerListeners.set(evt, new Set());
      playerListeners.get(evt).add(fn);
    },
    remove(evt, fn) {
      playerListeners.get(evt)?.delete(fn);
    },
    clear() {
      playerListeners.clear();
    },
  };

  // Back button handler registered by useGamepadNav / App
  window.__handleTvBack = () => false;

  const cleanUa = (() => {
    try {
      return bridge.getCleanUserAgent() || navigator.userAgent;
    } catch {
      return navigator.userAgent;
    }
  })();

  window.electron = {
    cleanUserAgent: cleanUa,

    // Stream & subtitle interception
    onM3u8Found: (cb) => addListener("m3u8-found", cb),
    offM3u8Found: (h) => removeListener("m3u8-found", h),
    onSubtitleFound: (cb) => addListener("subtitle-found", cb),
    offSubtitleFound: (h) => removeListener("subtitle-found", h),

    // Downloads (disabled/stubbed cleanly on TV)
    onDownloadProgress: (cb) => addListener("download-progress", cb),
    offDownloadProgress: (h) => removeListener("download-progress", h),
    checkDownloader: async () => ({ available: false, path: null }),
    runDownload: async () => ({
      ok: false,
      error: "Offline downloads are not supported on Android TV.",
    }),
    getDownloads: async () => [],
    deleteDownload: async () => ({ ok: true }),
    showInFolder: async () => {},
    fileExists: async () => false,
    scanDirectory: async () => [],
    pickFolder: async () => null,
    getInstallPath: async () => "/android",
    openPath: async () => {},
    openPathAtTime: async () => ({ ok: false }),
    pruneSubtitlePaths: async () => ({ ok: true, subtitlePaths: [] }),

    // External URL / Player Intent
    openExternal: async (url) => {
      try {
        bridge.openExternal(String(url || ""));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    openStreamExternal: (args) => invokeAsync("openStreamExternal", args),

    // Close confirmation
    onConfirmClose: (cb) => addListener("confirm-close", cb),
    offConfirmClose: (h) => removeListener("confirm-close", h),
    respondClose: () => {},

    // HiAnime resolver & local proxy
    resolveHiAnime: (args) => invokeAsync("resolveHiAnime", args),
    setPlayerVideo: (args) => invokeAsync("setPlayerVideo", args),
    onHiAnimeProgress: (cb) => {
      const h = (data) => cb(data?.stage ?? data);
      addListener("hianime-progress", h);
      return () => removeListener("hianime-progress", h);
    },
    debugHiAnime: async () => ({ error: "disabled" }),

    // App info
    getAppVersion: async () => {
      try {
        return bridge.getAppVersion() || "2.7.0";
      } catch {
        return "2.7.0";
      }
    },
    getDeviceType: () => deviceType,
    setFullscreen: (fullscreen) => {
      try {
        bridge.setFullscreen?.(!!fullscreen);
      } catch {}
    },
    getPlatform: async () => "android",

    // WebView fullscreen
    onWebviewEnterFullscreen: (cb) =>
      addListener("webview-enter-fullscreen", cb),
    offWebviewEnterFullscreen: (h) =>
      removeListener("webview-enter-fullscreen", h),
    onWebviewLeaveFullscreen: (cb) =>
      addListener("webview-leave-fullscreen", cb),
    offWebviewLeaveFullscreen: (h) =>
      removeListener("webview-leave-fullscreen", h),

    // Block stats
    onBlockedUpdate: (cb) => addListener("blocked-stats-update", cb),
    offBlockedUpdate: (h) => removeListener("blocked-stats-update", h),
    getBlockStats: async () => {
      try {
        return JSON.parse(bridge.getBlockStats() || '{"total":0,"domains":{}}');
      } catch {
        return { total: 0, domains: {} };
      }
    },

    // Notifications & app lifecycle
    showNotification: async () => {},
    quitApp: async () => {
      try {
        bridge.quitApp();
      } catch {}
    },
    playerStopped: () => {
      try {
        bridge.playerStopped();
      } catch {}
    },

    // Storage & cache
    getCacheSize: async () => {
      try {
        return Number(bridge.getCacheSize()) || 0;
      } catch {
        return 0;
      }
    },
    getDownloadsSize: async () => 0,
    clearAppCache: async () => {
      try {
        bridge.clearAppCache();
      } catch {}
      return { ok: true };
    },
    queryVideoProgress: () => invokeAsync("queryVideoProgress", {}),
    clearWatchData: async () => ({ ok: true }),
    deleteAllDownloads: async () => ({ ok: true }),
    resetApp: async () => {
      try {
        bridge.resetApp();
      } catch {}
      return { ok: true };
    },

    // Subtitles
    searchSubtitles: (args) => invokeAsync("searchSubtitles", args),
    getSubtitleUrl: (args) => invokeAsync("getSubtitleUrl", args),
    downloadSubtitlesForFile: async () => ({
      ok: false,
      error: "Not supported on Android TV",
    }),
    deleteSubtitleFile: async () => ({ ok: true }),

    // Wyzie key
    wyzieOpenRedeem: async () => {
      try {
        bridge.openExternal("https://sub.wyzie.io/redeem");
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    wyzieValidateKey: (key) => invokeAsync("wyzieValidateKey", { key }),

    // Secure key store (native SharedPreferences + file backup)
    secureGet: async (key) => {
      try {
        const v = bridge.secureGet(String(key));
        return v ? v : null;
      } catch {
        return null;
      }
    },
    getSavedTokenBackup: async () => {
      try {
        const v = bridge.getSavedTokenBackup?.();
        return v ? v : null;
      } catch {
        return null;
      }
    },
    secureSet: async (key, value) => {
      try {
        bridge.secureSet(String(key), value ? String(value) : "");
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    // PiP / Window controls (desktop-only no-ops on Android TV)
    openPipWindow: async () => ({ ok: false, reason: "unsupported-on-tv" }),
    closePipWindow: async () => {},
    getPipWebContentsId: async () => null,
    onPipOpened: () => () => {},
    offPipOpened: () => {},
    onPipClosed: () => () => {},
    offPipClosed: () => {},
    windowMinimize: async () => {},
    windowToggleMaximize: async () => {},
    windowClose: async () => {},
    windowIsMaximized: async () => true,
    onWindowMaximize: () => () => {},
    offWindowMaximize: () => {},
    getVideoDuration: async () => null,

    setZoomFactor: (factor) => {
      try {
        document.documentElement.style.zoom = String(factor || 1);
      } catch {}
    },

    // Auto-updater (APK support)
    detectUpdateFormat: async () => "apk",
    downloadAndInstallUpdate: (args) =>
      invokeAsync("downloadAndInstallUpdate", args),
    cancelUpdate: async () => {
      try {
        bridge.cancelUpdate();
      } catch {}
    },
    onUpdateProgress: (cb) => addListener("update-progress", cb),
    offUpdateProgress: (h) => removeListener("update-progress", h),

    // Scheduled backups (desktop filesystem only)
    getScheduledBackupSettings: async () => ({
      enabled: false,
      path: "",
      keepCount: 5,
      frequency: "startup",
      lastRun: null,
    }),
    setScheduledBackupSettings: async () => ({ ok: true }),
    performScheduledBackup: async () => ({ ok: false }),
    onScheduledBackupRequested: () => () => {},
    offScheduledBackupRequested: () => {},

    fetchReleaseImage: (url) => invokeAsync("fetchReleaseImage", { url }),

    // Discord RPC (not applicable on TV)
    discordRpcSetEnabled: async () => {},
    discordRpcUpdateActivity: async () => {},
  };
})();
