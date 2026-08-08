import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  readonly chatService = inject(ChatService);
  readonly translationService = inject(TranslationService);

  constructor() {
    // Load unread count when sidebar initializes
    this.chatService.loadUnreadCount();
  }

  setLanguage(lang: 'tr' | 'en'): void {
    this.translationService.setLanguage(lang);
  }
}
