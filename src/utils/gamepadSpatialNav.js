// Generic spatial navigation over whatever's currently in the DOM. Works
// for both Gamepad controllers and Android TV D-pad remotes.
//
// Add `data-gamepad-ignore` to any container to exclude it (and everything
// inside it) from navigation. Add `data-gamepad-close` to a modal's
// close/cancel button so Back / B can find it reliably.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  '[role="button"]:not([aria-disabled="true"])',
  ".card",
  ".sidebar-btn",
  ".saved-thumb",
  ".episode-card",
  ".search-result",
  ".search-history-item",
  ".source-dropdown__item",
  ".season-btn",
  ".settings-nav-btn",
  ".cast-card",
  ".chip",
  ".tv-brand",
  '[tabindex]:not([tabindex="-1"])',
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(",");

const FOCUS_CLASS = "gamepad-focused";

let currentEl = null;

function isVisible(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.closest("[data-gamepad-ignore]")) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (el.offsetParent === null && style.position !== "fixed") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  // Wide lookahead so vertical & horizontal TV scrolling reaches offscreen rows/cards.
  return (
    rect.bottom > -600 &&
    rect.top < window.innerHeight + 800 &&
    rect.right > -600 &&
    rect.left < window.innerWidth + 800
  );
}

const CLICKABLE_CURSORS = new Set(["pointer", "grab"]);

function collectPointerRoots(root) {
  const nodes = root.querySelectorAll(
    "div, span, li, article, section, figure",
  );
  const out = [];
  for (const el of nodes) {
    if (!CLICKABLE_CURSORS.has(getComputedStyle(el).cursor)) continue;
    const parent = el.parentElement;
    if (parent && CLICKABLE_CURSORS.has(getComputedStyle(parent).cursor))
      continue;
    if (!isVisible(el)) continue;
    out.push(el);
  }
  return out;
}

function isModalRoot(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (style.position !== "fixed") return false;
  if (el.classList.contains("source-dropdown--fixed")) return true;
  const rect = el.getBoundingClientRect();
  return (
    rect.width >= window.innerWidth * 0.45 &&
    rect.height >= window.innerHeight * 0.45
  );
}

function getScopeRoot() {
  const dropdowns = Array.from(
    document.querySelectorAll(
      ".source-dropdown--fixed, .context-menu, .sidebar-context-menu",
    ),
  ).filter((el) => isVisible(el));
  if (dropdowns.length > 0) return dropdowns[dropdowns.length - 1];

  const overlays = Array.from(
    document.querySelectorAll(
      '[class*="overlay"], .apikey-modal, [style*="z-index: 6000"]',
    ),
  ).filter((el) => isVisible(el) && isModalRoot(el));
  if (overlays.length === 0) return document;
  return overlays[overlays.length - 1];
}

function getCandidates() {
  const root = getScopeRoot();
  const semantic = root.querySelectorAll(FOCUSABLE_SELECTOR);
  const pointerRoots = collectPointerRoots(root);
  const seen = new Set();
  const out = [];
  for (const el of semantic) {
    if (!isVisible(el) || seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  for (const el of pointerRoots) {
    if (seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

function clearHighlight() {
  currentEl?.classList.remove(FOCUS_CLASS);
}

export function setGamepadFocus(el, { scroll = true } = {}) {
  clearHighlight();
  currentEl = el || null;
  if (!currentEl) return;
  currentEl.classList.add(FOCUS_CLASS);
  try {
    const tag = currentEl.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      currentEl.focus?.({ preventScroll: true });
    }
  } catch {}
  if (scroll) {
    currentEl.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }
}

export function getGamepadFocus() {
  return currentEl && document.contains(currentEl) ? currentEl : null;
}

export function clearGamepadFocus() {
  clearHighlight();
  currentEl = null;
}

export function confirmGamepadFocus() {
  const el = getGamepadFocus();
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    el.focus?.();
    try {
      if (window.AndroidBridge?.showKeyboardAt) {
        const rect = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        window.AndroidBridge.showKeyboardAt(
          Math.round((rect.left + rect.width / 2) * dpr),
          Math.round((rect.top + rect.height / 2) * dpr),
        );
      } else {
        el.click?.();
        window.AndroidBridge?.showKeyboard?.();
      }
    } catch {}
    return true;
  }
  el.click();
  return true;
}

export function dismissActiveOverlay() {
  const root = getScopeRoot();
  if (root === document) return false;
  const closeBtn = root.querySelector(
    '[data-gamepad-close], [aria-label="Close" i], .modal-close, .close-btn, .trailer-close-btn',
  );
  if (closeBtn instanceof HTMLElement) {
    closeBtn.click();
    return true;
  }
  if (root instanceof HTMLElement) {
    root.click();
    return true;
  }
  return false;
}

function pickInitial(candidates) {
  if (candidates.length === 0) return null;
  let best = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const isTopOrSide = !!(el.closest(".sidebar") || el.closest(".tv-topbar"));
    const isCloseBtn = el.hasAttribute("data-gamepad-close");
    const penalty = (isTopOrSide ? 500 : 0) + (isCloseBtn ? 800 : 0);
    const score = Math.max(0, r.top) * 2 + Math.max(0, r.left) + penalty;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function moveGamepadFocus(direction) {
  const candidates = getCandidates();
  if (candidates.length === 0) return false;

  const from = getGamepadFocus();
  if (!from || !candidates.includes(from)) {
    setGamepadFocus(pickInitial(candidates));
    return true;
  }

  const fromRect = from.getBoundingClientRect();
  const fromCx = fromRect.left + fromRect.width / 2;
  const fromCy = fromRect.top + fromRect.height / 2;

  let best = null;
  let bestScore = Infinity;

  if (direction === "left" || direction === "right") {
    const dir = direction === "right" ? 1 : -1;
    // Pass 1: strictly elements sharing vertical overlap (same visual row)
    for (const el of candidates) {
      if (el === from) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (cx - fromCx) * dir;
      if (dx <= 4) continue;
      const vOverlap =
        Math.min(fromRect.bottom, r.bottom) - Math.max(fromRect.top, r.top);
      if (vOverlap <= 2) continue;
      const score = dx + Math.abs(cy - fromCy) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    // Pass 2: fallback if no exact overlap
    if (!best) {
      for (const el of candidates) {
        if (el === from) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (cx - fromCx) * dir;
        if (dx <= 4) continue;
        const dy = Math.abs(cy - fromCy);
        if (dy > 120) continue;
        const score = dx + dy * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
    }
  } else {
    const dir = direction === "down" ? 1 : -1;
    // Row-banded vertical search: prefer the nearest vertical row below/above
    const valid = [];
    for (const el of candidates) {
      if (el === from) continue;
      const r = el.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const dy = (cy - fromCy) * dir;
      if (dy <= 6) continue;
      // Exclude elements that significantly overlap vertically with current element
      const verticalGap =
        dir === 1 ? r.top - fromRect.bottom : fromRect.top - r.bottom;
      if (verticalGap < -Math.min(fromRect.height, r.height) * 0.4) continue;
      valid.push({ el, r, dy });
    }
    if (valid.length > 0) {
      // Find the closest row band (minimum dy) and allow items within 28px of that band
      const minDy = Math.min(...valid.map((v) => v.dy));
      const bandThreshold = minDy + 36;
      for (const { el, r, dy } of valid) {
        if (dy > bandThreshold) continue;
        const cx = r.left + r.width / 2;
        const hOverlap =
          Math.min(fromRect.right, r.right) - Math.max(fromRect.left, r.left);
        const horizPenalty =
          hOverlap > 0 ? 0 : Math.abs(cx - fromCx) * 1.2;
        const score = dy + horizPenalty;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      // If somehow missed, score all valid
      if (!best) {
        for (const { el, r, dy } of valid) {
          const cx = r.left + r.width / 2;
          const score = dy * 2 + Math.abs(cx - fromCx);
          if (score < bestScore) {
            bestScore = score;
            best = el;
          }
        }
      }
    }
  }

  if (best) {
    setGamepadFocus(best);
    return true;
  }
  return false;
}

export function ensureInitialFocus() {
  const cur = getGamepadFocus();
  if (cur && isVisible(cur)) {
    const scope = getScopeRoot();
    if (scope === document || scope.contains(cur)) return;
  }
  setGamepadFocus(pickInitial(getCandidates()));
}
