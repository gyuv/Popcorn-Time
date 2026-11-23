import { useEffect, useRef, useState } from 'react';

// Plays the user's own media: local files, or a direct URL (e.g. from your Jellyfin/Plex/home server).
const srtToVtt = t => 'WEBVTT\n\n' + t.replace(/\r/g, '').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');

export default function Player() {
  const v = useRef(null);
  const [src, setSrc] = useState(''); const [name, setName] = useState('');
  const [subs, setSubs] = useState(null); const [url, setUrl] = useState('');
  const [rate, setRate] = useState(1);
  useEffect(() => { if (v.current) v.current.playbackRate = rate; }, [rate, src]);
  useEffect(() => { // resume position per file
    const el = v.current; if (!el || !name) return;
    const k = `pt-pos:${name}`; const save = () => localStorage.setItem(k, el.currentTime);
    const load = () => { const t = +localStorage.getItem(k); if (t > 5 && t < el.duration - 10) el.currentTime = t; };
    el.addEventListener('loadedmetadata', load); el.addEventListener('timeupdate', save);
    return () => { el.removeEventListener('loadedmetadata', load); el.removeEventListener('timeupdate', save); };
  }, [name, src]);

  const pick = e => { const f = e.target.files[0]; if (f) { setSrc(URL.createObjectURL(f)); setName(f.name); } };
  const pickSub = e => { const f = e.target.files[0]; if (f) f.text().then(t => setSubs(URL.createObjectURL(new Blob([f.name.endsWith('.srt') ? srtToVtt(t) : t], { type: 'text/vtt' })))); };
  const key = e => {
    const el = v.current; if (!el) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'MediaPlayPause') { el.paused ? el.play() : el.pause(); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'MediaFastForward') { el.currentTime += 10; e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowLeft' || e.key === 'MediaRewind') { el.currentTime -= 10; e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'f') el.requestFullscreen?.();
  };
  return (
    <div className="page">
      <h1>My Files</h1>
      <p className="muted">Play videos you own from this device, or paste a direct link from your own media server.</p>
      <div className="frow">
        <label className="btn primary">Open video file<input type="file" accept="video/*,.mkv" hidden onChange={pick} /></label>
        <label className="btn">Add subtitles (.srt/.vtt)<input type="file" accept=".srt,.vtt" hidden onChange={pickSub} /></label>
        <form className="pair" onSubmit={e => { e.preventDefault(); setSrc(url); setName(url); }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://my-server/video.mp4" /><button className="btn">Play URL</button></form>
        <label>Speed<select value={rate} onChange={e => setRate(+e.target.value)}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => <option key={r} value={r}>{r}×</option>)}</select></label>
      </div>
      {src && <div className="playerwrap" tabIndex={0} onKeyDown={key}>
        <video ref={v} src={src} controls autoPlay playsInline>{subs && <track src={subs} kind="subtitles" label="Subtitles" default />}</video>
        <p className="muted small">{name} · Space play/pause · ←/→ 10s · F fullscreen</p></div>}
    </div>
  );
}
