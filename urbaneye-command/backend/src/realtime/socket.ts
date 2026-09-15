import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

export let io: SocketIOServer | null = null;


export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', (socket: Socket) => {
    // Client can subscribe to their scoped district feed
    socket.on('join:district', (districtId: string) => {
      if (districtId) {
        socket.join(`district:${districtId}`);
        socket.join(`district:${districtId.toLowerCase()}`);
      }
    });

    // State admin can subscribe to their state feed
    socket.on('join:state', (stateId: string) => {
      if (stateId) {
        socket.join(`state:${stateId}`);
      }
    });

    // Mobile app can subscribe to its device session pairing status
    socket.on('join:session', (sessionId: string) => {
      if (sessionId) {
        socket.join(`session:${sessionId}`);
      }
    });

    // National admin can subscribe to all events
    socket.on('join:national', () => {
      socket.join('national:live');
    });

    // Traffic congestion room — subscribe to live congestion updates
    socket.on('join:traffic', (cityTag?: string) => {
      socket.join('traffic:live');
      if (cityTag) {
        socket.join(`traffic:${cityTag}`);
      }
    });

    // Demo mode control — start/stop from frontend
    socket.on('demo:start', (data?: { city?: string }) => {
      const city = data?.city || 'bangalore';
      console.log(`[Socket] demo:start requested for ${city}`);
      // Dynamic import to avoid circular dependency
      import('../traffic/demo-player.js').then(({ startDemoPlayer }) => {
        startDemoPlayer();
      }).catch((err) => {
        console.error('[Socket] Failed to start demo player:', err.message);
      });
    });

    socket.on('demo:stop', () => {
      console.log('[Socket] demo:stop requested');
      import('../traffic/demo-player.js').then(({ stopDemoPlayer }) => {
        stopDemoPlayer();
      }).catch((err) => {
        console.error('[Socket] Failed to stop demo player:', err.message);
      });
    });

    socket.on('disconnect', () => {
      // clean up automatically handled by socket.io
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitNewRoadEvent(event: any): void {
  if (!io) return;
  // Broadcast globally to all connected socket clients (web dashboard, mobile app)
  io.emit('event:new', event);
  io.emit('detection:new', event);

  // Send to district rooms
  io.to(`district:${event.districtId}`).emit('event:new', event);
  io.to(`district:${String(event.districtId).toLowerCase()}`).emit('event:new', event);
  if (event.district?.code) {
    io.to(`district:${String(event.district.code).toLowerCase()}`).emit('event:new', event);
  }
  if (event.district?.name) {
    io.to(`district:${String(event.district.name).toLowerCase()}`).emit('event:new', event);
  }
  // Send to state room
  if (event.district?.stateId) {
    io.to(`state:${event.district.stateId}`).emit('event:new', event);
  }
  // Send to national live overview
  io.to('national:live').emit('event:new', event);
}

/** A bus has just paired and joined the fleet. Puts a new marker on the map. */
export function emitBusPaired(bus: any): void {
  if (!io) return;
  io.emit('bus:paired', bus);
  if (bus.districtId) io.to(`district:${bus.districtId}`).emit('bus:paired', bus);
  io.to('national:live').emit('bus:paired', bus);
}

/** A bus reported a new position. Moves its marker. */
export function emitBusPosition(bus: any): void {
  if (!io) return;
  io.emit('bus:position', bus);
  if (bus.districtId) io.to(`district:${bus.districtId}`).emit('bus:position', bus);
  io.to('national:live').emit('bus:position', bus);
}

/** A bus was unpaired or went stale. Removes its marker. */
export function emitBusOffline(sessionId: string): void {
  if (!io) return;
  io.emit('bus:offline', { sessionId });
}

export function emitRoadEventUpdated(event: any): void {
  if (!io) return;
  io.emit('event:updated', event);
  io.emit('detection:updated', event);
  io.to(`district:${event.districtId}`).emit('event:updated', event);
  io.to(`district:${String(event.districtId).toLowerCase()}`).emit('event:updated', event);
  if (event.district?.code) {
    io.to(`district:${String(event.district.code).toLowerCase()}`).emit('event:updated', event);
  }
  if (event.district?.stateId) {
    io.to(`state:${event.district.stateId}`).emit('event:updated', event);
  }
  io.to('national:live').emit('event:updated', event);
}

export function emitRoadEventDeleted(eventId: string, districtId: string, stateId?: string): void {
  if (!io) return;
  io.emit('event:deleted', { id: eventId, districtId });
  io.to(`district:${districtId}`).emit('event:deleted', { id: eventId, districtId });
  io.to(`district:${String(districtId).toLowerCase()}`).emit('event:deleted', { id: eventId, districtId });
  if (stateId) {
    io.to(`state:${stateId}`).emit('event:deleted', { id: eventId, districtId });
  }
  io.to('national:live').emit('event:deleted', { id: eventId, districtId });
}

export function emitPairingConfirmed(session: any): void {
  if (!io) return;
  io.emit('pairing:confirmed', {
    status: 'PAIRED',
    deviceSessionId: session.id,
    busLabel: session.busLabel,
    routeTag: session.routeTag,
    districtId: session.districtId,
    districtName: session.district?.name,
  });
  io.to(`session:${session.id}`).emit('pairing:confirmed', {
    status: 'PAIRED',
    deviceSessionId: session.id,
    busLabel: session.busLabel,
    routeTag: session.routeTag,
    districtId: session.districtId,
    districtName: session.district?.name,
  });
}

/**
 * Emit a congestion update to all traffic subscribers
 */
export function emitCongestionUpdate(payload: any): void {
  if (!io) return;
  io.emit('traffic:congestion-update', payload);
  io.to('traffic:live').emit('traffic:congestion-update', payload);
}

