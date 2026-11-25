import { useState, useRef, useEffect } from "react";
import { imgUrl } from "../utils/api";
import { useSeasonalEvent } from "../components/seasonalEvents.jsx";
import { isAndroidTv, isElectronDesktop } from "../utils/platform";
import {
  StreambertLogo,
  HomeIcon,
  SearchIcon,
  HistoryIcon,
  FilmIcon,
  SettingsIcon,
  SlidersIcon,
  DownloadsQueueIcon,
  QuitIcon,
  BackIcon,
  HelpIcon,
} from "./Icons";

export default function Sidebar({
  page,
  onNavigate,
  onSearch,
  savedList,
  activeDownloads,
  onReorderSaved,
  onRemoveSaved,
  canGoBack,
  onBack,
  onShowShortcuts,
  onOpenPrefs,
}) {
  if (isAndroidTv()) {
    return (
      <TvTopBar
        page={page}
        onNavigate={onNavigate}
        onSearch={onSearch}
        canGoBack={canGoBack}
        onBack={onBack}
        onOpenPrefs={onOpenPrefs}
      />
    );
  }
  const desktop = isElectronDesktop();
  const [dragOver, setDragOver] = useState(null);
  const dragItem = useRef(null);
  const dragNode = useRef(null);
  const seasonalEvent = useSeasonalEvent();

  const [tooltip, setTooltip] = useState(null); // { title, y }
  const [contextMenu, setContextMenu] = useState(null); // { item, x, y }

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, []);

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setTooltip(null);
    setContextMenu({ item, x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e, index) => {
    dragItem.current = index;
    dragNode.current = e.currentTarget;
    setTimeout(() => {
      if (dragNode.current) dragNode.current.style.opacity = "0.4";
    }, 0);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    dragItem.current = null;
    dragNode.current = null;
    setDragOver(null);
  };

  const handleDragEnter = (e, index) => {
    if (dragItem.current === index) return;
    setDragOver(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const fromIndex = dragItem.current;
    if (fromIndex === null || fromIndex === dropIndex) return;

    const newList = [...savedList];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(dropIndex, 0, moved);

    const newOrder = newList.map((item) => `${item.media_type}_${item.id}`);
    onReorderSaved(newOrder);
    setDragOver(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleMouseEnter = (e, title) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ title, y: rect.top + rect.height / 2 });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="sidebar">
      <div
        className="sidebar-logo"
        onClick={() => onNavigate("home")}
        title="Popcorn-Time"
        style={{ position: "relative" }}
      >
        <StreambertLogo />
        {seasonalEvent && seasonalEvent.render()}
      </div>

      {canGoBack && (
        <SideBtn onClick={onBack} icon={<BackIcon />} label="Back (Ctrl+Z)" />
      )}

      <SideBtn onClick={onSearch} icon={<SearchIcon />} label="Search  (⌘F)" />
      <SideBtn
        active={page === "home"}
        onClick={() => onNavigate("home")}
        icon={<HomeIcon />}
        label="Home"
      />
      <SideBtn
        active={page === "history"}
        onClick={() => onNavigate("history")}
        icon={<HistoryIcon />}
        label="Library & History"
      />
      {desktop && (
        <SideBtn
          active={page === "downloads"}
          onClick={() => onNavigate("downloads")}
          icon={<DownloadsQueueIcon />}
          label="Downloads"
          badge={activeDownloads > 0 ? activeDownloads : null}
        />
      )}

      <div className="sidebar-sep" />

      <div className="sidebar-saved">
        {savedList.map((item, index) => {
          const key = `${item.media_type}_${item.id}`;
          const title = item.title || item.name;
          return (
            <div
              key={key}
              className={`saved-thumb${dragOver === index ? " drag-over" : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() =>
                onNavigate(item.media_type === "tv" ? "tv" : "movie", item)
              }
              onContextMenu={(e) => handleContextMenu(e, item)}
              onMouseEnter={(e) => handleMouseEnter(e, title)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: "grab", position: "relative" }}
            >
              {item.poster_path ? (
                <img src={imgUrl(item.poster_path, "w200")} alt={title} />
              ) : (
                <div className="no-img">
                  <FilmIcon />
                </div>
              )}
              {dragOver === index && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: "var(--accent, #e50914)",
                    borderRadius: 2,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {tooltip && (
        <div className="saved-thumb-tooltip" style={{ top: tooltip.y }}>
          {tooltip.title}
        </div>
      )}

      {contextMenu && (
        <div
          className="sidebar-context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="sidebar-context-menu-item"
            onClick={() => {
              onRemoveSaved && onRemoveSaved(contextMenu.item);
              setContextMenu(null);
            }}
          >
            Remove
          </div>
        </div>
      )}

      <div className="sidebar-bottom">
        {desktop && (
          <SideBtn
            onClick={onShowShortcuts}
            icon={<HelpIcon />}
            label="Help & Shortcuts (?)"
          />
        )}
        <SideBtn
          active={page === "settings"}
          onClick={() => onNavigate("settings")}
          icon={<SettingsIcon />}
          label="Settings"
        />
        {desktop && (
          <button
            className="sidebar-btn"
            onClick={() => window.electron?.quitApp?.()}
            title="Quit App"
            style={{ color: "#e53e3e", marginTop: 4 }}
          >
            <QuitIcon />
            <span className="tooltip">Quit App</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SideBtn({ active, onClick, icon, label, badge }) {
  return (
    <button
      className={`sidebar-btn ${active ? "active" : ""}`}
      onClick={onClick}
      style={{ position: "relative" }}
    >
      {icon}
      <span className="tooltip">{label}</span>
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: "var(--red)",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: "16px",
            textAlign: "center",
            padding: "0 4px",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function TvTopBar({
  page,
  onNavigate,
  onSearch,
  canGoBack,
  onBack,
  onOpenPrefs,
}) {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="tv-topbar">
      <div className="tv-topbar-left">
        {canGoBack && (
          <button
            className="tv-nav-pill tv-nav-pill--icon"
            onClick={onBack}
            title="Back"
          >
            <BackIcon />
          </button>
        )}
        <div className="tv-brand" onClick={() => onNavigate("home")}>
          <div className="tv-brand-logo">
            <StreambertLogo />
          </div>
          <span className="tv-brand-name">POPCORN-TIME</span>
        </div>
      </div>

      <nav className="tv-topbar-nav">
        <button
          className={`tv-nav-pill${page === "home" ? " tv-nav-pill--active" : ""}`}
          onClick={() => onNavigate("home")}
        >
          <HomeIcon />
          <span>Home</span>
        </button>
        <button
          className={`tv-nav-pill${page === "history" ? " tv-nav-pill--active" : ""}`}
          onClick={() => onNavigate("history")}
        >
          <HistoryIcon />
          <span>Library</span>
        </button>
        <button className="tv-nav-pill" onClick={onSearch}>
          <SearchIcon />
          <span>Search</span>
        </button>
        <button className="tv-nav-pill" onClick={onOpenPrefs}>
          <SlidersIcon size={17} />
          <span>Preferences</span>
        </button>
        <button
          className={`tv-nav-pill${page === "settings" ? " tv-nav-pill--active" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          <SettingsIcon />
          <span>Settings</span>
        </button>
      </nav>

      <div className="tv-topbar-right">
        <span className="tv-clock">{clock}</span>
      </div>
    </header>
  );
}
