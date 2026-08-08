import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatConversation, ChatPartner, UserRole } from '../../core/models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <!-- Left Panel: Conversations -->
      <div class="conversations-panel" [class.hidden-mobile]="chatService.activeConversationId()">

        <!-- Header -->
        <div class="panel-header">
          <h2 class="panel-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Messages
          </h2>
          <button class="new-chat-btn" (click)="showNewChat.set(!showNewChat())" title="New Conversation">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <!-- New Chat Panel -->
        @if (showNewChat()) {
        <div class="new-chat-panel">
          <input
            type="text"
            class="search-input"
            [placeholder]="isParent() ? 'Search teachers...' : 'Search parents...'"
            (input)="onSearchPartner($event)"
            [value]="partnerSearch()"
          />
          <div class="partner-list">
            @for (partner of filteredPartners(); track partner.id) {
            <button class="partner-item" (click)="startConversation(partner)">
              <div class="avatar" [style.background]="getAvatarColor(partner.firstName)">
                {{ getInitials(partner) }}
              </div>
              <div class="partner-info">
                <span class="partner-name">{{ partner.firstName }} {{ partner.lastName }}</span>
                <span class="partner-role">{{ getRoleLabel(partner.role) }}</span>
              </div>
            </button>
            } @empty {
            <div class="empty-partners">
              @if (chatService.partners().length === 0) {
                <span>Loading...</span>
              } @else {
                <span>No matches found</span>
              }
            </div>
            }
          </div>
        </div>
        }

        <!-- Search -->
        <div class="search-bar">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            (input)="onSearchConversation($event)"
            [value]="conversationSearch()"
          />
        </div>

        <!-- Conversation List -->
        <div class="conversation-list">
          @for (conv of filteredConversations(); track conv.id) {
          <button
            class="conversation-item"
            [class.active]="chatService.activeConversationId() === conv.id"
            (click)="selectConversation(conv)"
          >
            <div class="avatar" [style.background]="getAvatarColor(getOtherUser(conv).firstName)">
              {{ getInitials(getOtherUser(conv)) }}
            </div>
            <div class="conv-info">
              <div class="conv-top">
                <span class="conv-name">{{ getOtherUser(conv).firstName }} {{ getOtherUser(conv).lastName }}</span>
                @if (conv.messages?.length) {
                <span class="conv-time">{{ formatTime(conv.messages[0].createdAt) }}</span>
                }
              </div>
              <div class="conv-bottom">
                <span class="conv-preview">
                  @if (conv.messages?.length) {
                    {{ conv.messages[0].content.length > 40 ? conv.messages[0].content.substring(0, 40) + '...' : conv.messages[0].content }}
                  } @else {
                    No messages yet
                  }
                </span>
                @if (conv.unreadCount > 0) {
                <span class="unread-badge">{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</span>
                }
              </div>
            </div>
          </button>
          } @empty {
          <div class="empty-state">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="opacity:0.3">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No conversations yet</p>
            <span>Start a new conversation using the + button</span>
          </div>
          }
        </div>
      </div>

      <!-- Right Panel: Messages -->
      <div class="messages-panel" [class.hidden-mobile]="!chatService.activeConversationId()">
        @if (chatService.activeConversation()) {
        <!-- Message Header -->
        <div class="message-header">
          <button class="back-btn" (click)="chatService.setActiveConversation(null)">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="avatar avatar-sm" [style.background]="getAvatarColor(getOtherUser(chatService.activeConversation()!).firstName)">
            {{ getInitials(getOtherUser(chatService.activeConversation()!)) }}
          </div>
          <div class="header-info">
            <span class="header-name">{{ getOtherUser(chatService.activeConversation()!).firstName }} {{ getOtherUser(chatService.activeConversation()!).lastName }}</span>
            <span class="header-role">{{ getRoleLabel(getOtherUser(chatService.activeConversation()!).role) }}</span>
          </div>
          <div class="header-status">
            <span class="status-dot" [class.online]="chatService.connected()"></span>
          </div>
        </div>

        <!-- Messages Body -->
        <div class="messages-body" #messagesBody>
          @for (msg of chatService.activeMessages(); track msg.id) {
          <div class="message-row" [class.own]="msg.senderId === currentUserId()">
            <div class="message-bubble" [class.own]="msg.senderId === currentUserId()">
              <p class="message-text">{{ msg.content }}</p>
              <div class="message-meta">
                <span class="message-time">{{ formatTime(msg.createdAt) }}</span>
                @if (msg.senderId === currentUserId()) {
                <span class="read-status">{{ msg.isRead ? '✓✓' : '✓' }}</span>
                }
              </div>
            </div>
          </div>
          } @empty {
          <div class="empty-messages">
            <p>No messages yet. Send the first one!</p>
          </div>
          }
        </div>

        <!-- Message Input -->
        <div class="message-input-area">
          <div class="input-wrapper">
            <input
              type="text"
              class="message-input"
              placeholder="Type a message..."
              [(ngModel)]="messageText"
              (keydown.enter)="sendMessage()"
              [disabled]="!chatService.connected()"
              id="chat-message-input"
            />
            <button
              class="send-btn"
              (click)="sendMessage()"
              [disabled]="!messageText.trim() || !chatService.connected()"
              id="chat-send-btn"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
        } @else {
        <!-- No conversation selected -->
        <div class="no-conversation">
          <div class="no-conv-icon">
            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list or start a new one</p>
        </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .chat-container {
      display: flex;
      height: 100%;
      background: #f8fafc;
      overflow: hidden;
    }

    /* ──── Left Panel ──── */
    .conversations-panel {
      width: 360px;
      min-width: 320px;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #0f172a, #1e293b);
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0;
    }

    .panel-title svg {
      color: #3b82f6;
    }

    .new-chat-btn {
      background: rgba(59, 130, 246, 0.15);
      border: none;
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      color: #3b82f6;
      transition: all 0.2s;
    }

    .new-chat-btn:hover {
      background: rgba(59, 130, 246, 0.3);
      transform: scale(1.05);
    }

    /* ──── New Chat Panel ──── */
    .new-chat-panel {
      border-bottom: 1px solid #e2e8f0;
      padding: 12px;
      background: #f8fafc;
    }

    .partner-list {
      max-height: 200px;
      overflow-y: auto;
      margin-top: 8px;
    }

    .partner-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.15s;
      text-align: left;
    }

    .partner-item:hover {
      background: #e2e8f0;
    }

    .partner-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .partner-name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }

    .partner-role {
      font-size: 11px;
      color: #64748b;
    }

    .empty-partners {
      text-align: center;
      padding: 16px;
      color: #94a3b8;
      font-size: 13px;
    }

    /* ──── Search ──── */
    .search-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid #f1f5f9;
    }

    .search-bar svg {
      color: #94a3b8;
      flex-shrink: 0;
    }

    .search-bar input, .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 13px;
      color: #334155;
      background: transparent;
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: #3b82f6;
      outline: none;
    }

    /* ──── Conversation List ──── */
    .conversation-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 8px;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 10px;
      transition: background 0.15s;
      text-align: left;
    }

    .conversation-item:hover {
      background: #f1f5f9;
    }

    .conversation-item.active {
      background: #eff6ff;
      box-shadow: inset 3px 0 0 #3b82f6;
    }

    .conv-info {
      flex: 1;
      min-width: 0;
    }

    .conv-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }

    .conv-name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }

    .conv-time {
      font-size: 11px;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .conv-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .conv-preview {
      font-size: 12px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }

    .unread-badge {
      background: #3b82f6;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      flex-shrink: 0;
    }

    /* ──── Avatar ──── */
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
      text-transform: uppercase;
    }

    .avatar-sm {
      width: 34px;
      height: 34px;
      font-size: 12px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      gap: 8px;
      padding: 40px;
      text-align: center;
    }

    .empty-state p {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      margin: 0;
    }

    .empty-state span {
      font-size: 12px;
    }

    /* ──── Right Panel ──── */
    .messages-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .back-btn {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      padding: 4px;
      border-radius: 6px;
    }

    .back-btn:hover {
      background: #f1f5f9;
    }

    .header-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
    }

    .header-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .header-role {
      font-size: 11px;
      color: #64748b;
    }

    .header-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #94a3b8;
    }

    .status-dot.online {
      background: #22c55e;
      box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
    }

    /* ──── Messages Body ──── */
    .messages-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .message-row {
      display: flex;
      justify-content: flex-start;
    }

    .message-row.own {
      justify-content: flex-end;
    }

    .message-bubble {
      max-width: 70%;
      padding: 10px 14px;
      border-radius: 16px 16px 16px 4px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
      position: relative;
    }

    .message-bubble.own {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #fff;
      border-radius: 16px 16px 4px 16px;
    }

    .message-text {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .message-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 4px;
    }

    .message-time {
      font-size: 10px;
      opacity: 0.6;
    }

    .read-status {
      font-size: 11px;
      opacity: 0.7;
    }

    .empty-messages {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      font-size: 14px;
    }

    /* ──── Message Input Area ──── */
    .message-input-area {
      padding: 12px 20px 16px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f1f5f9;
      border-radius: 24px;
      padding: 4px 4px 4px 16px;
      border: 1px solid #e2e8f0;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-wrapper:focus-within {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .message-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 14px;
      color: #0f172a;
      padding: 8px 0;
    }

    .message-input::placeholder {
      color: #94a3b8;
    }

    .send-btn {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .send-btn:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ──── No Conversation ──── */
    .no-conversation {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      gap: 12px;
      padding: 40px;
      text-align: center;
    }

    .no-conv-icon {
      opacity: 0.15;
    }

    .no-conversation h3 {
      font-size: 18px;
      font-weight: 600;
      color: #64748b;
      margin: 0;
    }

    .no-conversation p {
      font-size: 13px;
      margin: 0;
    }

    /* ──── Responsive ──── */
    @media (max-width: 768px) {
      .conversations-panel {
        width: 100%;
        min-width: 0;
      }

      .hidden-mobile {
        display: none !important;
      }

      .back-btn {
        display: flex;
      }

      .message-bubble {
        max-width: 85%;
      }
    }

    /* ──── Scrollbar ──── */
    .conversation-list::-webkit-scrollbar,
    .messages-body::-webkit-scrollbar,
    .partner-list::-webkit-scrollbar {
      width: 5px;
    }

    .conversation-list::-webkit-scrollbar-track,
    .messages-body::-webkit-scrollbar-track,
    .partner-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .conversation-list::-webkit-scrollbar-thumb,
    .messages-body::-webkit-scrollbar-thumb,
    .partner-list::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly chatService = inject(ChatService);
  readonly authService = inject(AuthService);

  @ViewChild('messagesBody') messagesBody?: ElementRef<HTMLDivElement>;

  messageText = '';
  showNewChat = signal(false);
  partnerSearch = signal('');
  conversationSearch = signal('');
  private shouldScrollToBottom = false;

  readonly currentUserId = computed(() => this.authService.user()?.id ?? '');
  readonly isParent = computed(() => this.authService.user()?.role === UserRole.PARENT);

  readonly filteredPartners = computed(() => {
    const search = this.partnerSearch().toLowerCase();
    return this.chatService.partners().filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search)
    );
  });

  readonly filteredConversations = computed(() => {
    const search = this.conversationSearch().toLowerCase();
    if (!search) return this.chatService.conversations();
    return this.chatService.conversations().filter(c => {
      const other = this.getOtherUser(c);
      return `${other.firstName} ${other.lastName}`.toLowerCase().includes(search);
    });
  });

  ngOnInit(): void {
    // Connect to WebSocket
    this.chatService.connect();

    // Load data
    this.chatService.loadConversations();
    this.chatService.loadPartners();
    this.chatService.loadUnreadCount();
  }

  ngOnDestroy(): void {
    // Keep WebSocket connected for unread count updates
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  selectConversation(conv: ChatConversation): void {
    this.chatService.setActiveConversation(conv.id);
    this.shouldScrollToBottom = true;
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    const activeId = this.chatService.activeConversationId();
    if (!text || !activeId) return;

    this.chatService.sendMessage(activeId, text);
    this.messageText = '';
    this.shouldScrollToBottom = true;
  }

  startConversation(partner: ChatPartner): void {
    const currentUser = this.authService.user();
    if (!currentUser) return;

    let teacherId: string;
    let parentId: string;

    if (currentUser.role === UserRole.PARENT) {
      parentId = currentUser.id;
      teacherId = partner.id;
    } else {
      teacherId = currentUser.id;
      parentId = partner.id;
    }

    this.chatService.startConversation(teacherId, parentId);
    this.showNewChat.set(false);
    this.partnerSearch.set('');
    this.shouldScrollToBottom = true;
  }

  onSearchPartner(event: Event): void {
    this.partnerSearch.set((event.target as HTMLInputElement).value);
  }

  onSearchConversation(event: Event): void {
    this.conversationSearch.set((event.target as HTMLInputElement).value);
  }

  getOtherUser(conv: ChatConversation): ChatPartner {
    const userId = this.currentUserId();
    return conv.teacherId === userId ? conv.parent : conv.teacher;
  }

  getInitials(user: ChatPartner | { firstName: string; lastName: string }): string {
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
      '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  }

  getRoleLabel(role?: UserRole | string): string {
    switch (role) {
      case UserRole.TEACHER: return 'Teacher';
      case UserRole.GUIDE_TEACHER: return 'Guide Teacher';
      case UserRole.PARENT: return 'Parent';
      case UserRole.ADMIN: return 'Administrator';
      default: return '';
    }
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private scrollToBottom(): void {
    const el = this.messagesBody?.nativeElement;
    if (el) {
      // Use requestAnimationFrame for smoother scroll
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }
}
