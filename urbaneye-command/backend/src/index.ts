import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initSocketIO, getConnectedClientsCount } from './realtime/socket.js';
import { prisma, ensureDatabaseInitialized } from './prisma.js';
import { authRouter } from './auth/auth.router.js';
import { pairingRouter } from './pairing/pairing.router.js';
import { fleetRouter } from './pairing/fleet.js';
import { eventsRouter } from './events/events.router.js';
import { geographyRouter } from './geography/geography.router.js';
import { trafficRouter } from './traffic/traffic.router.js';
import { congestionRouter } from './traffic/congestion.router.js';
import { incidentsRouter } from './incidents/incidents.router.js';
import { safetyRouter } from './safety/safety.router.js';
import { predictiveRouter } from './predictive/predictive.router.js';
import { modelsRouter } from './models/models.router.js';
import { detectRouter } from './models/detect.js';
import { reportingRouter } from './reporting/reporting.router.js';
import { workordersRouter } from './workorders/workorders.router.js';
import { gpsRouter } from './gps/gps.router.js';
import { startDemoPlayer } from './traffic/demo-player.js';
import { apiRateLimiter, authRateLimiter, ingestionRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

dotenv.config();

// Process Level Security & Crash Guards
process.on('uncaughtException', (err) => {
  console.error(`[CRITICAL] Uncaught Exception: ${err.message}`, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

const app = express();
const server = http.createServer(app);

// Initialize real-time Socket.IO
initSocketIO(server);

// Enterprise Security Headers & Correlation ID Middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Powered-By', 'SRIMS-SmartCity-Engine');
  (req as any).correlationId = correlationId;
  next();
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Rate Limiters
app.use('/api/', apiRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/events', ingestionRateLimiter);

// URL Normalizer: Strip duplicate slashes (e.g. //api/pairing/request -> /api/pairing/request)
app.use((req, res, next) => {
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/^\/+/, '/');
  }
  next();
});

// Request logger
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.url.startsWith('/api/pairing/status')) {
    console.log(`[${new Date().toISOString()}] [${(req as any).correlationId}] ${req.method} ${req.url}`);
  }
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/pairing', fleetRouter);
app.use('/api/pairing', pairingRouter);
app.use('/api/events', eventsRouter);
app.use('/api/detections', eventsRouter);
app.use('/detections', eventsRouter);
app.use('/api/geography', geographyRouter);
app.use('/api/traffic', trafficRouter);
app.use('/api/traffic', congestionRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/safety', safetyRouter);
app.use('/api/predictive', predictiveRouter);
app.use('/api/reporting', reportingRouter);
app.use('/api/workorders', workordersRouter);
app.use('/api/models', detectRouter);
app.use('/api/models', modelsRouter);
app.use('/api/gps', gpsRouter);

// Serve uploaded images (e.g. citizen reports, camera captures)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Enterprise Telemetry & Health Check API
app.get('/api/health', async (req, res) => {
  let dbStatus = 'DISCONNECTED';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
  } catch (err: any) {
    dbStatus = `LIMITED / IN_MEMORY_FALLBACK (${err.message?.slice(0, 40) || 'DB offline'})`;
  }

  const memUsage = process.memoryUsage();
  res.json({
    status: 'HEALTHY',
    service: 'SRIMS Command Center Engine',
    version: '2.4.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
    },
    sockets: {
      connectedClients: getConnectedClientsCount(),
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMb: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    },
  });
});

// Production: Serve the built Vite frontend dashboard
const clientDistCandidates = [
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(process.cwd(), '../web/dist'),
  path.resolve(process.cwd(), 'srims-command/web/dist'),
  path.resolve(__dirname, '../public'),
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(p));
if (clientDistPath) {
  console.log(`🌐 Serving production web dashboard from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/socket.io') || req.url.startsWith('/detections')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Enterprise Error Handler Middleware
app.use(globalErrorHandler);

// Render Free Tier Anti-Sleep Keep-Alive Heartbeat
function startRenderKeepAlive() {
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || process.env.VITE_API_URL;
  if (!keepAliveUrl) return;

  const targetHealthUrl = keepAliveUrl.endsWith('/api/health')
    ? keepAliveUrl
    : `${keepAliveUrl.replace(/\/$/, '')}/api/health`;

  console.log(`⏱️ Render Free Tier Keep-Alive enabled! Pinging ${targetHealthUrl} every 10 mins...`);
  setInterval(() => {
    try {
      const parsedUrl = new URL(targetHealthUrl);
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;
      httpModule.get(targetHealthUrl, (res) => {
        console.log(`[Keep-Alive Heartbeat] Status ${res.statusCode} at ${new Date().toISOString()}`);
      }).on('error', (err) => {
        console.warn(`[Keep-Alive Notice] ${err.message}`);
      });
    } catch (e) {
      // Ignore invalid URL errors
    }
  }, 10 * 60 * 1000);
}

const PORT = process.env.PORT || 5000;
(async () => {
  await ensureDatabaseInitialized();
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🛡️  SRIMS Command Backend listening on port ${PORT}`);
    console.log(`📡 WebSocket / Socket.IO live intelligence streaming active`);
    console.log(`🔗 REST API endpoints mounted at /api/*`);
    console.log(`====================================================`);
    startRenderKeepAlive();

    // Auto-start demo mode if DEMO_MODE env var is set
    const demoMode = process.env.DEMO_MODE;
    if (demoMode) {
      console.log(`🎬 DEMO_MODE=${demoMode} detected — auto-starting demo player in 3s...`);
      setTimeout(() => startDemoPlayer(), 3000);
    }
  });
})();
