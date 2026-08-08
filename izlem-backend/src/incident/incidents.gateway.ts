import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { Incident } from '@prisma/client';

/**
 * Incident Gateway - Real-time WebSocket communication for incidents.
 *
 * Features:
 * - JWT authentication on connection
 * - School-based room isolation (tenant isolation)
 * - Events: new_incident, incident_received, incident_alarm
 *
 * Connection Flow:
 * 1. Client connects with JWT token in auth header
 * 2. Gateway validates JWT and extracts schoolId
 * 3. Socket joins school-specific room: `school_{schoolId}`
 * 4. Client receives events only from their school
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure for production
    credentials: true,
  },
  namespace: '/incidents',
})
export class IncidentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(IncidentsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Handle new WebSocket connections.
   * Validates JWT and joins the socket to the school room.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Verify JWT
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const { sub: userId, schoolId, email, role } = payload;

      if (!schoolId) {
        throw new UnauthorizedException('Invalid token: missing schoolId');
      }

      // Verify user still exists and is active
      const user = await this.prisma.user.findFirst({
        where: { id: userId, schoolId, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Attach user data to socket for later use
      client.data.userId = userId;
      client.data.schoolId = schoolId;
      client.data.email = email;
      client.data.role = role;

      // Join school-specific room for tenant isolation
      const roomName = `school_${schoolId}`;
      await client.join(roomName);

      this.logger.log(
        `Client connected: ${email} (${role}) joined room ${roomName}`,
      );

      // Send connection acknowledgment
      client.emit('connected', {
        message: 'Connected to İzlem real-time gateway',
        room: roomName,
        userId,
      });
    } catch (error) {
      this.logger.warn(
        `Connection rejected: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  /**
   * Handle WebSocket disconnections.
   */
  handleDisconnect(client: Socket): void {
    const email = client.data?.email || 'Unknown';
    this.logger.log(`Client disconnected: ${email}`);
  }

  /**
   * Emit new incident event to the school room.
   * Called by IncidentService when a teacher logs a new incident.
   * Includes full incident object for direct injection on clients.
   */
  emitNewIncident(
    schoolId: string,
    payload: {
      incidentId: string;
      studentName: string;
      categoryName: string;
      teacherName: string;
      timestamp: Date;
      incident: Incident; // Full incident object for direct injection
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('new_incident', {
      type: 'NEW_INCIDENT',
      ...payload,
    });
    this.logger.log(
      `Emitted new_incident to ${roomName}: ${payload.studentName}`,
    );
  }

  /**
   * Emit incident received event to the school room.
   * Called when a Guide marks an incident as RECEIVED.
   */
  emitIncidentReceived(
    schoolId: string,
    payload: {
      incidentId: string;
      studentName: string;
      receivedByName: string;
      receivedAt: Date;
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('incident_received', {
      type: 'INCIDENT_RECEIVED',
      ...payload,
    });
    this.logger.log(
      `Emitted incident_received to ${roomName}: ${payload.incidentId}`,
    );
  }

  /**
   * Emit incident alarm when monitor marks incident as UNACCOUNTED.
   * Called by IncidentMonitorService for timed-out incidents.
   */
  emitIncidentAlarm(
    schoolId: string,
    payload: {
      incidentId: string;
      studentName: string;
      minutesOverdue: number;
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('incident_alarm', {
      type: 'INCIDENT_ALARM',
      severity: 'HIGH',
      ...payload,
    });
    this.logger.warn(
      `⚠️ Emitted incident_alarm to ${roomName}: ${payload.incidentId} (${payload.minutesOverdue}min overdue)`,
    );
  }

  /**
   * Emit incident resolved event to the school room.
   * Called when a Guide marks an UNACCOUNTED incident as RESOLVED.
   */
  emitIncidentResolved(
    schoolId: string,
    payload: {
      incidentId: string;
      studentName: string;
      resolvedByName: string;
      resolvedAt: Date;
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('incident_resolved', {
      type: 'INCIDENT_RESOLVED',
      ...payload,
    });
    this.logger.log(
      `Emitted incident_resolved to ${roomName}: ${payload.incidentId}`,
    );
  }

  /**
   * Emit rule triggered event to the school room.
   * Called by RuleEngineService when a progressive threshold is met.
   * Admin dashboard listens for this to show real-time automated actions feed.
   */
  emitRuleTriggered(
    schoolId: string,
    payload: {
      triggeredActionId: string;
      studentName: string;
      categoryName: string;
      actionType: string;
      count: number;
      threshold: number;
      description: string;
      timestamp: Date;
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('rule_triggered', {
      type: 'RULE_TRIGGERED',
      ...payload,
    });
    this.logger.warn(
      `⚡ Emitted rule_triggered to ${roomName}: ${payload.actionType} for ${payload.studentName} (${payload.categoryName})`,
    );
  }

  /**
   * Emit flag_resolved event when a Guide/Admin resolves a flagged student's triggered action.
   * The Guide HUD listens to remove the student from the "Flagged Students" panel in real-time.
   */
  emitFlagResolved(
    schoolId: string,
    payload: {
      triggeredActionId: string;
      studentId: string;
      resolvedByName: string;
      resolutionOutcome: string;
      timestamp: Date;
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('flag_resolved', {
      type: 'FLAG_RESOLVED',
      ...payload,
    });
    this.logger.log(
      `✅ Emitted flag_resolved to ${roomName}: ${payload.triggeredActionId} (${payload.resolutionOutcome})`,
    );
  }

  /**
   * Emit student_flagged event for Guide HUD flagging panel.
   * Sent when REQUIRE_ADMIN_MEETING or ASSIGN_DETENTION actions are triggered.
   */
  emitStudentFlagged(
    schoolId: string,
    payload: {
      studentId: string;
      studentName: string;
      actionType: string;
      description: string;
      categoryName: string;
      count: number;
      threshold: number;
      triggeredActionId: string;
      timestamp: Date;
    },
  ): void {
    const roomName = `school_${schoolId}`;
    this.server.to(roomName).emit('student_flagged', {
      type: 'STUDENT_FLAGGED',
      ...payload,
    });
    this.logger.warn(
      `🚩 Emitted student_flagged to ${roomName}: ${payload.actionType} for ${payload.studentName}`,
    );
  }
}

/*
 * ============================================================
 * BROWSER TEST SNIPPET
 * ============================================================
 * To test the WebSocket connection, run this in the browser console:
 *
 * // First, get a JWT token by logging in
 * const token = 'YOUR_JWT_TOKEN_HERE';
 *
 * // Load Socket.IO client
 * const script = document.createElement('script');
 * script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
 * document.head.appendChild(script);
 *
 * // Wait for script to load, then connect:
 * setTimeout(() => {
 *   const socket = io('http://localhost:3000/incidents', {
 *     auth: { token }
 *   });
 *
 *   socket.on('connect', () => console.log('✅ Connected!'));
 *   socket.on('connected', (data) => console.log('🏫 Joined room:', data));
 *   socket.on('new_incident', (data) => console.log('🆕 New incident:', data));
 *   socket.on('incident_received', (data) => console.log('✅ Received:', data));
 *   socket.on('incident_alarm', (data) => console.log('🚨 ALARM:', data));
 *   socket.on('error', (err) => console.error('❌ Error:', err));
 * }, 1000);
 *
 * ============================================================
 */
