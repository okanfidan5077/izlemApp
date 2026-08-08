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

/**
 * Chat Gateway - Real-time WebSocket communication for teacher-parent chat.
 *
 * Namespace: /chat
 * Auth: JWT token in handshake
 * Rooms: user_{userId} (private per user)
 *
 * Events emitted:
 * - 'new_message': { message, conversationId, sender }
 * - 'messages_read': { conversationId, readByUserId }
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Track connected users for online/offline status
  private readonly connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Handle new WebSocket connections.
   * Validates JWT and joins the socket to a user-specific room.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const { sub: userId, schoolId, email, role } = payload;

      if (!schoolId) {
        throw new UnauthorizedException('Invalid token: missing schoolId');
      }

      const user = await this.prisma.user.findFirst({
        where: { id: userId, schoolId, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Attach user data to socket
      client.data.userId = userId;
      client.data.schoolId = schoolId;
      client.data.email = email;
      client.data.role = role;

      // Join user-specific room (for private message delivery)
      const userRoom = `user_${userId}`;
      await client.join(userRoom);

      // Track connected user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      this.logger.log(`Chat client connected: ${email} (${role}) joined room ${userRoom}`);

      client.emit('chat_connected', {
        message: 'Connected to İzlem Chat',
        userId,
      });
    } catch (error) {
      this.logger.warn(
        `Chat connection rejected: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  /**
   * Handle WebSocket disconnections.
   */
  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId;
    const email = client.data?.email || 'Unknown';

    if (userId && this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(client.id);
      if (this.connectedUsers.get(userId)!.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    this.logger.log(`Chat client disconnected: ${email}`);
  }

  /**
   * Check if a user is currently connected to the chat gateway.
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  /**
   * Emit a new message event to a specific user's room.
   */
  emitNewMessage(
    recipientUserId: string,
    payload: {
      message: any;
      conversationId: string;
      sender: { id: string; firstName: string; lastName: string };
    },
  ): void {
    const userRoom = `user_${recipientUserId}`;
    this.server.to(userRoom).emit('new_message', {
      type: 'NEW_MESSAGE',
      ...payload,
    });
    this.logger.log(
      `💬 Emitted new_message to ${userRoom}: from ${payload.sender.firstName}`,
    );
  }

  /**
   * Emit messages_read event to notify the sender that their messages were read.
   */
  emitMessagesRead(
    recipientUserId: string,
    payload: {
      conversationId: string;
      readByUserId: string;
    },
  ): void {
    const userRoom = `user_${recipientUserId}`;
    this.server.to(userRoom).emit('messages_read', {
      type: 'MESSAGES_READ',
      ...payload,
    });
    this.logger.log(
      `✅ Emitted messages_read to ${userRoom}: conversation ${payload.conversationId}`,
    );
  }
}
