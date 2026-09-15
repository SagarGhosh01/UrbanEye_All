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
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('onnxruntime-web')) {
              return 'vendor-onnx';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            return 'vendor-libs';
          }
        },
      },
    },
  },
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
