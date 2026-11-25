import { useEffect, useRef, useState } from "react";
import { BTN, useGamepadLoop } from "./gamepad";
import {
  moveGamepadFocus,
  confirmGamepadFocus,
  dismissActiveOverlay,
  ensureInitialFocus,
  clearGamepadFocus,
  getGamepadFocus,
} from "./gamepadSpatialNav";
import { isPlayerGamepadActive } from "./gamepadPlayerState";

/**
 * App-wide Gamepad + Android TV D-Pad remote navigation.
 *
 *  D-pad / Arrow keys  → move spatial focus between cards, buttons, links
 *  A / Enter / Select  → activate focused element (opens IME for inputs)
 *  B / Back / Escape   → exit fullscreen → close modal → navigate back
 *  Start / Search key  → open search
 */
export function useGamepadNav({ enabled, onBack, onOpenSearch }) {
  const [connected, setConnected] = useState(false);

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const onOpenSearchRef = useRef(onOpenSearch);
  onOpenSearchRef.current = onOpenSearch;

  const isAndroid = typeof window !== "undefined" && !!window.AndroidBridge;

  useGamepadLoop(
    {
      onConnectionChange: setConnected,
      onDirection: (dir) => {
        ensureInitialFocus();
        moveGamepadFocus(dir);
      },
      onButtonDown: (i) => {
        if (i === BTN.A) {
          ensureInitialFocus();
          confirmGamepadFocus();
        } else if (i === BTN.B) {
          if (!dismissActiveOverlay()) onBackRef.current?.();
        } else if (i === BTN.START) {
          onOpenSearchRef.current?.();
        }
      },
    },
    () => !isPlayerGamepadActive(),
    enabled,
  );

  useEffect(() => {
    if (!enabled) return;

    const handleTvBack = () => {
      if (document.documentElement.hasAttribute("data-player-fullscreen")) {
        window.dispatchEvent(new CustomEvent("streambert:tv-exit-fullscreen"));
        return true;
      }
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      ) {
        active.blur();
        return true;
      }
      if (dismissActiveOverlay()) return true;
      const handled = onBackRef.current?.();
      return !!handled;
    };

    window.__handleTvBack = handleTvBack;
    window.__tvOnEnter = () => {
      ensureInitialFocus();
      return confirmGamepadFocus();
    };

    const onKeyDown = (e) => {
      const isFullscreenPlayer =
        document.documentElement.hasAttribute("data-player-fullscreen");
      if (isFullscreenPlayer && isAndroid) {
        if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack") {
          e.preventDefault();
          handleTvBack();
        }
        return;
      }
      if (!isAndroid && isPlayerGamepadActive()) return;

      const active = document.activeElement;
      const isTextInput =
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (isTextInput) {
          active.blur();
        }
        e.preventDefault();
        ensureInitialFocus();
        moveGamepadFocus(e.key === "ArrowUp" ? "up" : "down");
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (isTextInput) {
          if (active.value && active.value.length > 0) return;
          active.blur();
        }
        e.preventDefault();
        ensureInitialFocus();
        moveGamepadFocus(e.key === "ArrowLeft" ? "left" : "right");
        return;
      }

      if (e.key === "Enter" || e.key === "NumpadEnter") {
        if (isTextInput) return;
        const focused = getGamepadFocus();
        if (focused) {
          e.preventDefault();
          confirmGamepadFocus();
        } else if (isAndroid) {
          e.preventDefault();
          ensureInitialFocus();
        }
        return;
      }

      if (
        e.key === "Escape" ||
        e.key === "GoBack" ||
        e.key === "BrowserBack" ||
        (e.key === "Backspace" && !isTextInput)
      ) {
        if (isAndroid) {
          e.preventDefault();
          handleTvBack();
        }
        return;
      }

      if (e.key === "Search" || e.key === "MediaSearch") {
        e.preventDefault();
        onOpenSearchRef.current?.();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.__handleTvBack = () => false;
      window.__tvOnEnter = () => false;
    };
  }, [enabled, isAndroid]);

  useEffect(() => {
    if (!enabled || !isAndroid) return;
    const t = setTimeout(() => {
      if (!getGamepadFocus()) ensureInitialFocus();
    }, 350);
    return () => clearTimeout(t);
  }, [enabled, isAndroid]);

  useEffect(() => {
    if (!enabled) {
      clearGamepadFocus();
      setConnected(false);
    }
  }, [enabled]);

  return { connected };
}
