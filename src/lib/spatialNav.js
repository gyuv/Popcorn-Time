// D-pad / arrow-key navigation for Android TV remotes and keyboards.
// Arrow keys move focus to the nearest focusable element in that direction.
const SEL = 'a[href], button:not([disabled]), input, select, [tabindex="0"]';
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export function installSpatialNav() {
  window.addEventListener('keydown', e => {
    const d = DIRS[e.key];
    if (!d) return;
    const cur = document.activeElement;
    if (cur && (cur.tagName === 'INPUT' && cur.type !== 'checkbox' && cur.type !== 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) return;
    if (cur?.tagName === 'SELECT' || cur?.tagName === 'VIDEO') return;
    const root = document.querySelector('.modal') || document;
    const els = [...root.querySelectorAll(SEL)].filter(el => el.offsetParent !== null && el !== cur);
    if (!cur || cur === document.body) { els[0]?.focus(); e.preventDefault(); return; }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of els) {
      const b = el.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const dx = x - cx, dy = y - cy;
      const along = dx * d[0] + dy * d[1];
      if (along <= 4) continue;
      const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      e.preventDefault();
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  });
  // Android TV "back" arrives as Escape/Backspace in the WebView.
  window.addEventListener('keydown', e => {
    if ((e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') && !document.querySelector('.modal')) {
      if (location.hash && location.hash !== '#/') history.back();
    }
  });
}
