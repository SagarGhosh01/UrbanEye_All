import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend port. Defaults to 5000; override when something else already holds it —
// on macOS the AirPlay Receiver listens on 5000 and returns 403 to every request,
// which looks exactly like a broken API until you go looking for it:
//   BACKEND_PORT=5050 npm run dev   (and start the backend with PORT=5050)
const backendPort = process.env.BACKEND_PORT || '5000';
const backendTarget = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true
      },
      '/socket.io': {
        target: backendTarget,
        ws: true
      }
    }
  }
});
