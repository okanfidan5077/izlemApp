import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import {
  ApiResponse,
  ChatConversation,
  ChatMessage,
  ChatMessagePage,
  ChatPartner,
  NewChatMessageEvent,
  MessagesReadEvent,
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  private socket: Socket | null = null;
  private readonly chatWsUrl = environment.chatWsUrl;
  private readonly apiUrl = environment.apiUrl;

  // Signals
  private _conversations = signal<ChatConversation[]>([]);
  private _activeConversationId = signal<string | null>(null);
  private _activeMessages = signal<ChatMessage[]>([]);
  private _unreadCount = signal<number>(0);
  private _connected = signal<boolean>(false);
  private _partners = signal<ChatPartner[]>([]);
  private _loading = signal<boolean>(false);

  // Public signals
  readonly conversations = this._conversations.asReadonly();
  readonly activeConversationId = this._activeConversationId.asReadonly();
  readonly activeMessages = this._activeMessages.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly connected = this._connected.asReadonly();
  readonly partners = this._partners.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly activeConversation = computed(() => {
    const id = this._activeConversationId();
    return this._conversations().find(c => c.id === id) ?? null;
  });

  constructor() {
    // Auto-disconnect when user logs out
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.disconnect();
      }
    });
  }

  // ──── WebSocket ──────────────────────────────────

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.getToken();
    if (!token) {
      console.warn('Cannot connect to chat WebSocket: No auth token');
      return;
    }

    console.log('💬 Connecting to Chat WebSocket at', this.chatWsUrl);

    this.socket = io(this.chatWsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Chat WebSocket connected');
      this._connected.set(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Chat WebSocket disconnected:', reason);
      this._connected.set(false);
    });

    this.socket.on('chat_connected', (data: any) => {
      console.log('💬 Chat connected:', data);
    });

    this.socket.on('new_message', (event: NewChatMessageEvent) => {
      console.log('💬 New message:', event);
      this.handleNewMessage(event);
    });

    this.socket.on('messages_read', (event: MessagesReadEvent) => {
      console.log('✅ Messages read:', event);
      this.handleMessagesRead(event);
    });

    this.socket.on('error', (err: any) => {
      console.error('Chat WebSocket error:', err);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._connected.set(false);
      this._conversations.set([]);
      this._activeMessages.set([]);
      this._activeConversationId.set(null);
      this._unreadCount.set(0);
      console.log('💬 Chat WebSocket disconnected');
    }
  }

  // ──── REST API ───────────────────────────────────

  loadConversations(): void {
    this._loading.set(true);
    this.http.get<ApiResponse<ChatConversation[]>>(`${this.apiUrl}/chat/conversations`).subscribe({
      next: (res) => {
        this._conversations.set(res.data);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load conversations:', err);
        this._loading.set(false);
      },
    });
  }

  loadMessages(conversationId: string): void {
    this._loading.set(true);
    this._activeConversationId.set(conversationId);
    this.http.get<ApiResponse<ChatMessagePage>>(`${this.apiUrl}/chat/conversations/${conversationId}/messages`).subscribe({
      next: (res) => {
        this._activeMessages.set(res.data.messages);
        this._loading.set(false);
        // Mark as read
        this.markAsRead(conversationId);
      },
      error: (err) => {
        console.error('Failed to load messages:', err);
        this._loading.set(false);
      },
    });
  }

  sendMessage(conversationId: string, content: string): void {
    this.http.post<ApiResponse<ChatMessage>>(
      `${this.apiUrl}/chat/conversations/${conversationId}/messages`,
      { content }
    ).subscribe({
      next: (res) => {
        // Add message to active messages
        this._activeMessages.update(msgs => [...msgs, res.data]);
        // Update conversation preview
        this._conversations.update(convs =>
          convs.map(c =>
            c.id === conversationId
              ? { ...c, messages: [res.data], updatedAt: new Date() }
              : c
          )
        );
      },
      error: (err) => {
        console.error('Failed to send message:', err);
      },
    });
  }

  markAsRead(conversationId: string): void {
    this.http.patch<ApiResponse<any>>(
      `${this.apiUrl}/chat/conversations/${conversationId}/read`,
      {}
    ).subscribe({
      next: () => {
        // Update local unread count
        this._conversations.update(convs =>
          convs.map(c =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        );
        this.recalculateUnreadCount();
      },
      error: (err) => console.error('Failed to mark as read:', err),
    });
  }

  loadUnreadCount(): void {
    this.http.get<ApiResponse<{ unreadCount: number }>>(`${this.apiUrl}/chat/unread-count`).subscribe({
      next: (res) => this._unreadCount.set(res.data.unreadCount),
      error: (err) => console.error('Failed to load unread count:', err),
    });
  }

  loadPartners(): void {
    this.http.get<ApiResponse<ChatPartner[]>>(`${this.apiUrl}/chat/partners`).subscribe({
      next: (res) => this._partners.set(res.data),
      error: (err) => console.error('Failed to load partners:', err),
    });
  }

  startConversation(teacherId: string, parentId: string): void {
    this._loading.set(true);
    this.http.post<ApiResponse<ChatConversation>>(
      `${this.apiUrl}/chat/conversations`,
      { teacherId, parentId }
    ).subscribe({
      next: (res) => {
        const conv = res.data;
        // Add to list if not already present
        this._conversations.update(convs => {
          const exists = convs.find(c => c.id === conv.id);
          if (exists) return convs;
          return [{ ...conv, unreadCount: 0 }, ...convs];
        });
        // Open the conversation
        this.loadMessages(conv.id);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to start conversation:', err);
        this._loading.set(false);
      },
    });
  }

  setActiveConversation(id: string | null): void {
    this._activeConversationId.set(id);
    if (id) {
      this.loadMessages(id);
    } else {
      this._activeMessages.set([]);
    }
  }

  // ──── Real-time handlers ─────────────────────────

  private handleNewMessage(event: NewChatMessageEvent): void {
    const userId = this.authService.user()?.id;

    // If the message is for the active conversation, add it
    if (this._activeConversationId() === event.conversationId) {
      this._activeMessages.update(msgs => {
        const exists = msgs.find(m => m.id === event.message.id);
        if (exists) return msgs;
        return [...msgs, event.message];
      });
      // Auto-mark as read since user is looking at this conversation
      this.markAsRead(event.conversationId);
    } else {
      // Increment unread count for the conversation
      this._conversations.update(convs =>
        convs.map(c =>
          c.id === event.conversationId
            ? { ...c, unreadCount: (c.unreadCount || 0) + 1, messages: [event.message] }
            : c
        )
      );
      this._unreadCount.update(c => c + 1);
    }

    // Move conversation to top
    this._conversations.update(convs => {
      const idx = convs.findIndex(c => c.id === event.conversationId);
      if (idx <= 0) return convs;
      const [conv] = convs.splice(idx, 1);
      return [{ ...conv, updatedAt: new Date() }, ...convs];
    });
  }

  private handleMessagesRead(event: MessagesReadEvent): void {
    // If the current user's messages were read in the active conversation
    if (this._activeConversationId() === event.conversationId) {
      this._activeMessages.update(msgs =>
        msgs.map(m => ({ ...m, isRead: true }))
      );
    }
  }

  private recalculateUnreadCount(): void {
    const total = this._conversations().reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    this._unreadCount.set(total);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
