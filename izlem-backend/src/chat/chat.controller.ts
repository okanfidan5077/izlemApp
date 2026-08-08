import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { SendMessageDto, CreateConversationDto } from './dto';

@Controller('chat')
@Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.PARENT)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * GET /chat/conversations
   * List all conversations for the current user.
   */
  @Get('conversations')
  async getConversations(@Req() req: AuthenticatedRequest) {
    return this.chatService.getConversationsForUser(req.user.userId, req.schoolId);
  }

  /**
   * POST /chat/conversations
   * Get or create a conversation between teacher and parent.
   */
  @Post('conversations')
  async createConversation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(
      dto.teacherId,
      dto.parentId,
      req.schoolId,
    );
  }

  /**
   * GET /chat/conversations/:id/messages
   * Get paginated messages for a conversation.
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(
      conversationId,
      req.user.userId,
      req.schoolId,
      page || 1,
      limit || 50,
    );
  }

  /**
   * POST /chat/conversations/:id/messages
   * Send a message in a conversation.
   * Also emits real-time WebSocket event and queues offline email if needed.
   */
  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const result = await this.chatService.sendMessage(
      conversationId,
      req.user.userId,
      req.schoolId,
      dto.content,
    );

    // Emit real-time event to recipient
    this.chatGateway.emitNewMessage(result.recipientId, {
      message: result.message,
      conversationId,
      sender: {
        id: result.sender.id,
        firstName: result.sender.firstName,
        lastName: result.sender.lastName,
      },
    });

    // If recipient is offline, queue email notification
    if (!this.chatGateway.isUserOnline(result.recipientId)) {
      const senderName = `${result.sender.firstName} ${result.sender.lastName}`;
      await this.chatService.queueOfflineNotification(
        senderName,
        {
          id: result.recipient.id,
          email: result.recipient.email,
          firstName: result.recipient.firstName,
          lastName: result.recipient.lastName,
        },
        req.schoolId,
      );
    }

    return result.message;
  }

  /**
   * PATCH /chat/conversations/:id/read
   * Mark all messages as read in a conversation.
   */
  @Patch('conversations/:id/read')
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    const result = await this.chatService.markAsRead(
      conversationId,
      req.user.userId,
      req.schoolId,
    );

    // Notify the other participant that their messages were read
    const otherUserId = await this.chatService.getOtherParticipant(
      conversationId,
      req.user.userId,
      req.schoolId,
    );

    if (otherUserId) {
      this.chatGateway.emitMessagesRead(otherUserId, {
        conversationId,
        readByUserId: req.user.userId,
      });
    }

    return result;
  }

  /**
   * GET /chat/unread-count
   * Get total unread message count.
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.chatService.getUnreadCount(req.user.userId, req.schoolId);
  }

  /**
   * GET /chat/partners
   * Get available chat partners for the current user.
   */
  @Get('partners')
  async getChatPartners(@Req() req: AuthenticatedRequest) {
    return this.chatService.getChatPartners(
      req.user.userId,
      req.user.role,
      req.schoolId,
    );
  }
}
