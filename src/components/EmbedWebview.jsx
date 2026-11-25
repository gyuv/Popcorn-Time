import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { isAndroidApp, isElectronDesktop } from "../utils/platform";

/**
 * Drop-in replacement for Electron's <webview> element across all platforms:
 * - On Electron Desktop: renders the native <webview> tag directly.
 * - On Android (TV & Mobile): renders a layout placeholder div and syncs its
 *   screen bounds and URL to Kotlin's native overlay player WebView (which
 *   performs ad-blocking, header stripping, m3u8/vtt sniffing, siteTweaks CSS
 *   injection, and remote/fullscreen playback controls).
 * - On Web Browser: renders a responsive <iframe> embed with compatible
 *   imperative methods and load/error event forwarding.
 */
const EmbedWebview = forwardRef(function EmbedWebview(
  { src, useragent, partition, allowpopups, sandbox, style, className, tabIndex },
  ref,
) {
  if (isAndroidApp()) {
    return (
      <AndroidEmbedWebview
        ref={ref}
        src={src}
        useragent={useragent}
        style={style}
        className={className}
      />
    );
  }

  if (isElectronDesktop()) {
    return (
      <webview
        ref={ref}
        src={src}
        useragent={useragent}
        partition={partition}
        allowpopups={allowpopups}
        sandbox={sandbox}
        style={style}
        className={className}
        tabIndex={tabIndex}
      />
    );
  }

  return (
    <WebEmbedIframe
      ref={ref}
      src={src}
      style={style}
      className={className}
      tabIndex={tabIndex}
    />
  );
});

const WebEmbedIframe = forwardRef(function WebEmbedIframe(
  { src, style, className, tabIndex },
  ref,
) {
  const iframeRef = useRef(null);
  const listenersRef = useRef(new Map());
  const currentSrcRef = useRef(src || "about:blank");

  useEffect(() => {
    currentSrcRef.current = src || "about:blank";
  }, [src]);

  const emit = (evt, payload = {}) => {
    const set = listenersRef.current.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch {}
    }
  };

  useImperativeHandle(ref, () => {
    const handle = {
      executeJavaScript() {
        // Cross-origin iframes cannot run arbitrary JS in standard browsers
        return Promise.resolve(null);
      },
      addEventListener(evt, fn) {
        if (!listenersRef.current.has(evt)) {
          listenersRef.current.set(evt, new Set());
        }
        listenersRef.current.get(evt).add(fn);
      },
      removeEventListener(evt, fn) {
        listenersRef.current.get(evt)?.delete(fn);
      },
      getWebContentsId() {
        return null;
      },
    };
    Object.defineProperty(handle, "src", {
      get() {
        return iframeRef.current?.src || currentSrcRef.current;
      },
      set(nextUrl) {
        const u = nextUrl || "about:blank";
        currentSrcRef.current = u;
        if (iframeRef.current) {
          iframeRef.current.src = u;
        }
      },
    });
    return handle;
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src || "about:blank"}
      className={className}
      tabIndex={tabIndex}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="origin"
      onLoad={() => {
        if (currentSrcRef.current && currentSrcRef.current !== "about:blank") {
          emit("dom-ready", {});
          emit("did-finish-load", {});
        }
      }}
      onError={() => {
        emit("did-fail-load", {});
      }}
      style={{
        border: "none",
        background: "#000",
        ...style,
      }}
    />
  );
});

const AndroidEmbedWebview = forwardRef(function AndroidEmbedWebview(
  { src, useragent, style, className },
  ref,
) {
  const boxRef = useRef(null);
  const currentSrcRef = useRef(src || "about:blank");
  const evalCallIdRef = useRef(1);
  const pendingEvalRef = useRef(new Map());

  useEffect(() => {
    window.__androidEvalResolve = (id, ok, resultJson) => {
      const entry = pendingEvalRef.current.get(id);
      if (!entry) return;
      pendingEvalRef.current.delete(id);
      if (!ok) {
        entry.reject(new Error(resultJson || "eval failed"));
        return;
      }
      try {
        entry.resolve(resultJson ? JSON.parse(resultJson) : null);
      } catch {
        entry.resolve(resultJson);
      }
    };
    return () => {
      delete window.__androidEvalResolve;
      pendingEvalRef.current.clear();
    };
  }, []);

  const syncBounds = () => {
    const el = boxRef.current;
    const bridge = window.AndroidBridge;
    if (!el || !bridge?.setPlayerBounds) return;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const inTrailer = !!el.closest(".trailer-overlay");
    const occludedByOverlay = inTrailer
      ? !!document.querySelector(".source-dropdown, .context-menu, .sidebar-context-menu")
      : !!document.querySelector(
          ".modal-overlay, .source-dropdown, .context-menu, .sidebar-context-menu, .trailer-overlay, .tv-upnext-overlay",
        );
    const visible =
      !occludedByOverlay &&
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      cs.opacity !== "0" &&
      rect.width > 10 &&
      rect.height > 10 &&
      currentSrcRef.current !== "about:blank";
    const dpr = window.devicePixelRatio || 1;
    bridge.setPlayerBounds(
      Math.round(rect.left * dpr),
      Math.round(rect.top * dpr),
      Math.round(rect.width * dpr),
      Math.round(rect.height * dpr),
      !!visible,
    );
  };

  useImperativeHandle(ref, () => {
    const handle = {
      executeJavaScript(code) {
        return new Promise((resolve, reject) => {
          const bridge = window.AndroidBridge;
          if (!bridge?.evalPlayerJs) return resolve(null);
          const id = evalCallIdRef.current++;
          pendingEvalRef.current.set(id, { resolve, reject });
          try {
            bridge.evalPlayerJs(id, String(code || ""));
          } catch (e) {
            pendingEvalRef.current.delete(id);
            reject(e);
          }
        });
      },
      addEventListener(evt, fn) {
        window.__androidPlayerListeners?.add(evt, fn);
      },
      removeEventListener(evt, fn) {
        window.__androidPlayerListeners?.remove(evt, fn);
      },
      getWebContentsId() {
        return 1;
      },
    };
    Object.defineProperty(handle, "src", {
      get() {
        return currentSrcRef.current;
      },
      set(nextUrl) {
        const u = nextUrl || "about:blank";
        currentSrcRef.current = u;
        try {
          window.AndroidBridge?.loadPlayerUrl(u, useragent || "");
        } catch {}
        syncBounds();
      },
    });
    return handle;
  }, [useragent]);

  // Load URL when `src` prop changes
  useEffect(() => {
    const next = src || "about:blank";
    currentSrcRef.current = next;
    try {
      if (next === "about:blank") {
        window.AndroidBridge?.playerStopped?.();
      } else {
        window.AndroidBridge?.loadPlayerUrl(next, useragent || "");
      }
    } catch {}
    syncBounds();
  }, [src, useragent]);

  // Keep native overlay bounds synced on resize/scroll/visibility changes
  useEffect(() => {
    syncBounds();
    const el = boxRef.current;
    const ro = el && window.ResizeObserver ? new ResizeObserver(syncBounds) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);
    const interval = setInterval(syncBounds, 250);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
      clearInterval(interval);
      try {
        window.AndroidBridge?.setPlayerBounds(0, 0, 0, 0, false);
      } catch {}
    };
  }, [style?.visibility, style?.opacity]);

  // Stop and hide native player overlay on unmount
  useEffect(() => {
    return () => {
      try {
        window.AndroidBridge?.playerStopped?.();
        window.AndroidBridge?.setPlayerBounds(0, 0, 0, 0, false);
      } catch {}
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className={className}
      data-android-player-slot="1"
      style={{
        background: "#000",
        ...style,
      }}
    />
  );
});

export default EmbedWebview;
