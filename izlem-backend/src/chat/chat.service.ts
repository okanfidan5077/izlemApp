import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Get or create a conversation between a teacher and a parent.
   * Validates that the teacher has a TEACHER/GUIDE_TEACHER role and the parent has PARENT role.
   */
  async getOrCreateConversation(
    teacherId: string,
    parentId: string,
    schoolId: string,
  ) {
    // Validate both users exist and belong to the same school
    const [teacher, parent] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: teacherId,
          schoolId,
          role: { in: [UserRole.TEACHER, UserRole.GUIDE_TEACHER] },
          isActive: true,
        },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
      this.prisma.user.findFirst({
        where: {
          id: parentId,
          schoolId,
          role: UserRole.PARENT,
          isActive: true,
        },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
    ]);

    if (!teacher) {
      throw new NotFoundException('Teacher not found or not active in this school');
    }
    if (!parent) {
      throw new NotFoundException('Parent not found or not active in this school');
    }

    // Find existing or create new conversation
    let conversation = await this.prisma.chatConversation.findUnique({
      where: {
        teacherId_parentId_schoolId: { teacherId, parentId, schoolId },
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true, isRead: true },
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.chatConversation.create({
        data: {
          teacherId,
          parentId,
          schoolId,
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          parent: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, content: true, senderId: true, createdAt: true, isRead: true },
          },
        },
      });
      this.logger.log(`Created new conversation: ${conversation.id} between teacher ${teacherId} and parent ${parentId}`);
    }

    return conversation;
  }

  /**
   * Get all conversations for a user with last message preview and unread count.
   */
  async getConversationsForUser(userId: string, schoolId: string) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        schoolId,
        OR: [
          { teacherId: userId },
          { parentId: userId },
        ],
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true, isRead: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Attach unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            isRead: false,
          },
        });
        return { ...conv, unreadCount };
      }),
    );

    return result;
  }

  /**
   * Get paginated messages for a conversation.
   * Validates the user is a participant.
   */
  async getMessages(
    conversationId: string,
    userId: string,
    schoolId: string,
    page = 1,
    limit = 50,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        schoolId,
        OR: [{ teacherId: userId }, { parentId: userId }],
      },
    });

    if (!conversation) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return { messages, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Send a message in a conversation.
   * Returns the created message with sender info.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    schoolId: string,
    content: string,
  ) {
    // Validate sender is a participant
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        schoolId,
        OR: [{ teacherId: senderId }, { parentId: senderId }],
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!conversation) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        content,
        senderId,
        conversationId,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // Touch the conversation's updatedAt
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Message sent in conversation ${conversationId} by ${senderId}`);

    // Determine recipient for offline notification
    const recipientId = conversation.teacherId === senderId
      ? conversation.parentId
      : conversation.teacherId;

    const recipient = conversation.teacherId === senderId
      ? conversation.parent
      : conversation.teacher;

    const sender = conversation.teacherId === senderId
      ? conversation.teacher
      : conversation.parent;

    return {
      message,
      recipientId,
      recipient,
      sender,
    };
  }

  /**
   * Mark all messages in a conversation as read for a specific user.
   */
  async markAsRead(conversationId: string, userId: string, schoolId: string) {
    // Validate user is a participant
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        schoolId,
        OR: [{ teacherId: userId }, { parentId: userId }],
      },
    });

    if (!conversation) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const result = await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { markedAsRead: result.count };
  }

  /**
   * Get total unread message count across all conversations for a user.
   */
  async getUnreadCount(userId: string, schoolId: string) {
    const count = await this.prisma.chatMessage.count({
      where: {
        conversation: {
          schoolId,
          OR: [{ teacherId: userId }, { parentId: userId }],
        },
        senderId: { not: userId },
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Get available chat partners for a user.
   * - For parents: returns all active teachers in the school
   * - For teachers: returns all active parents in the school
   */
  async getChatPartners(userId: string, userRole: string, schoolId: string) {
    if (userRole === UserRole.PARENT) {
      // Parents can chat with any teacher in the school
      return this.prisma.user.findMany({
        where: {
          schoolId,
          role: { in: [UserRole.TEACHER, UserRole.GUIDE_TEACHER] },
          isActive: true,
          id: { not: userId },
        },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
    } else {
      // Teachers can chat with any parent in the school
      return this.prisma.user.findMany({
        where: {
          schoolId,
          role: UserRole.PARENT,
          isActive: true,
          id: { not: userId },
        },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
    }
  }

  /**
   * Queue an email notification for an offline recipient.
   */
  async queueOfflineNotification(
    senderName: string,
    recipient: { id: string; email: string; firstName: string; lastName: string },
    schoolId: string,
  ) {
    this.logger.log(`📧 Queueing chat notification email for ${recipient.email}`);

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        channel: 'EMAIL',
        subject: `İzlem: New message from ${senderName}`,
        message: `You have a new message from ${senderName}. Log in to your İzlem portal to respond.`,
        recipientId: recipient.id,
        schoolId,
        status: 'PENDING',
      },
    });

    // Queue the email job
    await this.notificationsQueue.add(
      'chat-email',
      {
        notificationId: notification.id,
        senderName,
        recipient,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'QUEUED' },
    });

    this.logger.log(`📧 Chat notification queued: ${notification.id}`);
  }

  /**
   * Get the other participant's userId in a conversation.
   */
  async getOtherParticipant(
    conversationId: string,
    currentUserId: string,
    schoolId: string,
  ): Promise<string | null> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        schoolId,
        OR: [{ teacherId: currentUserId }, { parentId: currentUserId }],
      },
      select: { teacherId: true, parentId: true },
    });

    if (!conversation) return null;

    return conversation.teacherId === currentUserId
      ? conversation.parentId
      : conversation.teacherId;
  }
}
