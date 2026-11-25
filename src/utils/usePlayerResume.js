import { useEffect, useRef } from "react";
import { buildResumeSeekScript } from "./playerResume";

/**
 * Automatically seeks the embedded player `<video>` to the saved resume
 * position once media metadata loads, and shields saved progress from being
 * overwritten by `0:00` ticks while seeking is in progress.
 */
export function usePlayerResume({
  webviewRef,
  playing,
  sourceKey,
  resumeTarget,
  progressViaFrames = false,
  lastKnownTimeRef,
}) {
  const pendingResumeRef = useRef(false);

  useEffect(() => {
    const savedSecs = Number(resumeTarget?.savedSecs || 0);
    const savedPct = Number(resumeTarget?.savedPct || 0);
    const hasTarget = savedSecs > 5 || (savedPct > 2 && savedPct < 98);

    if (!playing || !hasTarget) {
      pendingResumeRef.current = false;
      return;
    }

    pendingResumeRef.current = true;
    if (savedSecs > 5 && lastKnownTimeRef) {
      lastKnownTimeRef.current = savedSecs;
    }

    let cancelled = false;
    let settledCount = 0;
    let attempts = 0;
    let noVideoAfterLoad = 0;
    let pageLoaded = false;
    const maxAttempts = 80; // ~36 seconds for slow manifests
    const script = buildResumeSeekScript({ savedSecs, savedPct });

    const runAttempt = async () => {
      if (cancelled) return;
      const wv = webviewRef.current;
      if (!wv) return;
      attempts += 1;
      try {
        const res = await wv.executeJavaScript(script);
        if (cancelled) return;

        if (res?.state === "settled") {
          noVideoAfterLoad = 0;
          settledCount += 1;
          if (lastKnownTimeRef && (res.currentTime || res.target)) {
            lastKnownTimeRef.current = Math.max(
              lastKnownTimeRef.current || 0,
              res.currentTime || res.target,
            );
          }
          if (settledCount >= 2) {
            pendingResumeRef.current = false;
            clearInterval(interval);
          }
          return;
        }

        if (res?.state === "user_seeked" || res?.state === "no_target") {
          pendingResumeRef.current = false;
          clearInterval(interval);
          return;
        }

        settledCount = 0;
        if (res?.state === "seeking" && res.target && lastKnownTimeRef) {
          noVideoAfterLoad = 0;
          lastKnownTimeRef.current = res.target;
        } else if (res?.state === "loading") {
          noVideoAfterLoad = 0;
        } else if (res?.state === "no_video" && pageLoaded) {
          noVideoAfterLoad += 1;
          if (progressViaFrames && noVideoAfterLoad >= 10) {
            pendingResumeRef.current = false;
            clearInterval(interval);
            return;
          }
        }
      } catch {}

      if (attempts >= maxAttempts) {
        pendingResumeRef.current = false;
        clearInterval(interval);
      }
    };

    const startTimer = setTimeout(runAttempt, 250);
    const interval = setInterval(runAttempt, 450);

    const wv = webviewRef.current;
    const onLoad = () => {
      pageLoaded = true;
      settledCount = 0;
      setTimeout(runAttempt, 250);
    };
    try {
      wv?.addEventListener?.("did-finish-load", onLoad);
      wv?.addEventListener?.("dom-ready", onLoad);
    } catch {}

    return () => {
      cancelled = true;
      pendingResumeRef.current = false;
      clearTimeout(startTimer);
      clearInterval(interval);
      try {
        wv?.removeEventListener?.("did-finish-load", onLoad);
        wv?.removeEventListener?.("dom-ready", onLoad);
      } catch {}
    };
  }, [
    playing,
    sourceKey,
    resumeTarget?.savedSecs,
    resumeTarget?.savedPct,
    progressViaFrames,
    webviewRef,
    lastKnownTimeRef,
  ]);

  return pendingResumeRef;
}
