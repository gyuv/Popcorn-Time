import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';
import { installSpatialNav } from './lib/spatialNav.js';
import './styles/global.css';

installSpatialNav();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});

createRoot(document.getElementById('root')).render(
  <StoreProvider><HashRouter><App /></HashRouter></StoreProvider>
);
