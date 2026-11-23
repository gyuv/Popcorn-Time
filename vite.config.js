import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' so the same build works on the web, in Electron (file://) and in Capacitor.
export default defineConfig({ plugins: [react()], base: './' });
