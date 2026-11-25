import { storage } from "./storage";

/**
 * Shared JS snippet that locates the primary HTMLVideoElement across the top
 * document, open shadow roots, and same-origin iframes.
 */
export const FIND_VIDEO_EXPR = `
  (function findVideo(root) {
    if (!root) return null;
    try {
      var direct = root.querySelectorAll ? root.querySelectorAll('video') : [];
      var best = null;
      for (var i = 0; i < direct.length; i++) {
        var c = direct[i];
        if (c && c.duration && isFinite(c.duration) && c.duration > 0) return c;
        if (!best) best = c;
      }
      if (best) return best;
      var all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (var j = 0; j < all.length; j++) {
        var el = all[j];
        if (el.shadowRoot) {
          var sv = findVideo(el.shadowRoot);
          if (sv) return sv;
        }
        if (el.tagName === 'IFRAME') {
          try {
            var fv = findVideo(el.contentDocument);
            if (fv) return fv;
          } catch (e) {}
        }
      }
    } catch (e) {}
    return null;
  })(document)
`;

/**
 * Read saved resume seconds and percentage for a movie/episode progressKey.
 */
export function readSavedResumeState(progressKey, progressMap, isWatched = false) {
  if (!progressKey || isWatched) {
    return { savedSecs: 0, savedPct: 0 };
  }
  const rawSecs = Number(storage.get("dlTime_" + progressKey) || 0);
  const rawPct = Number(progressMap?.[progressKey] || 0);
  const savedSecs = Number.isFinite(rawSecs) && rawSecs > 5 ? Math.floor(rawSecs) : 0;
  const savedPct =
    Number.isFinite(rawPct) && rawPct > 2 && rawPct < 98 ? Math.floor(rawPct) : 0;
  return { savedSecs, savedPct };
}

/**
 * Build a script for the player webview to query active playback progress.
 */
export function buildProgressQueryScript() {
  return `(() => {
    const v = ${FIND_VIDEO_EXPR};
    if (!v || !v.duration || !isFinite(v.duration)) return null;
    if (v.ended) {
      return {
        currentTime: v.duration,
        duration: v.duration,
        ended: true,
        recentUserSeek: false,
        lastUserSeekTo: null,
      };
    }
    if (v.paused) return null;
    if (!v._seekTracked) {
      v._seekTracked = true;
      v.addEventListener('seeked', () => {
        if (v._internalSeekAt && Date.now() - v._internalSeekAt < 900) return;
        v._lastUserSeek = Date.now();
        v._lastUserSeekTo = v.currentTime;
      });
    }
    return {
      currentTime: v.currentTime,
      duration: v.duration,
      ended: false,
      recentUserSeek: v._lastUserSeek ? (Date.now() - v._lastUserSeek < 6000) : false,
      lastUserSeekTo: v._lastUserSeekTo ?? null,
    };
  })()`;
}

/**
 * Build a script for the player webview to seek `<video>` to saved position once ready.
 */
export function buildResumeSeekScript({ savedSecs = 0, savedPct = 0 }) {
  const secs = Math.max(0, Math.floor(Number(savedSecs) || 0));
  const pct = Math.max(0, Math.min(99, Number(savedPct) || 0));
  return `(() => {
    const v = ${FIND_VIDEO_EXPR};
    if (!v) return { state: 'no_video' };
    if (!v._seekTracked) {
      v._seekTracked = true;
      v.addEventListener('seeked', () => {
        if (v._internalSeekAt && Date.now() - v._internalSeekAt < 900) return;
        v._lastUserSeek = Date.now();
        v._lastUserSeekTo = v.currentTime;
      });
    }
    if (v._lastUserSeek && Date.now() - v._lastUserSeek < 30000) {
      return { state: 'user_seeked', currentTime: v.currentTime, duration: v.duration };
    }
    if (!v.duration || !isFinite(v.duration) || v.duration <= 0 || v.readyState < 1) {
      return { state: 'loading' };
    }
    let target = ${secs} > 5 ? ${secs} : (${pct} > 2 && ${pct} < 98 ? Math.floor((${pct} / 100) * v.duration) : 0);
    target = Math.min(target, Math.max(0, v.duration - 5));
    if (target <= 5) return { state: 'no_target' };
    if (Math.abs(v.currentTime - target) <= 8 && v.currentTime > 5) {
      if (v.paused) {
        try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      }
      return { state: 'settled', currentTime: v.currentTime, duration: v.duration, target };
    }
    v._internalSeekAt = Date.now();
    v.currentTime = target;
    if (v.paused) {
      try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
    return { state: 'seeking', currentTime: v.currentTime, duration: v.duration, target };
  })()`;
}
