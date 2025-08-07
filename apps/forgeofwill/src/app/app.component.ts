import {
  ButtonComponent,
  CardComponent,
  ModalComponent,
} from '@optimistic-tanuki/common-ui';
import { Component, effect, inject, Inject, Optional, PLATFORM_ID, signal } from '@angular/core';
import {
  MessageComponent,
  MessageService,
  MessageType,
} from '@optimistic-tanuki/message-ui';
import { Router, RouterModule } from '@angular/router';

import { AuthStateService } from './auth-state.service';
import { ChatMessage, ChatUiComponent, SocketChatService } from '@optimistic-tanuki/chat-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
import { isPlatformBrowser } from '@angular/common';
import { ProfileService } from './profile/profile.service';

@Component({
  imports: [
    RouterModule,
    CardComponent,
    ButtonComponent,
    ModalComponent,
    ThemeToggleComponent,
    ChatUiComponent,
    MessageComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'forgeofwill';
  isModalOpen = signal<boolean>(false);
  messages = signal<MessageType[]>([]);
  socketChat?: SocketChatService;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly router: Router,
    private readonly authState: AuthStateService,
    private readonly messageService: MessageService,
    private readonly profileService: ProfileService,
  ) {
    effect(() => {
      this.messages.set(this.messageService.messages());
      console.log('Messages updated:', this.messages());
    });
    if (isPlatformBrowser(this.platformId)) {
      this.socketChat = inject(SocketChatService);
      this.socketChat.onMessage((message) => {
        console.log('New message received:', message);
      });
      this.socketChat.onConversations((data) => {
        console.log('Conversations update received:', data);
      });
      // this.socketChat.getConversations(this.profileService.currentUserProfile()!.id);
    }
  }

  ngOnInit() {
    this.authState.isAuthenticated$().subscribe({
      next: (isAuthenticated) => {
        console.log('Authentication state changed:', isAuthenticated);
        this.isAuthenticated.set(isAuthenticated);
        const currentProfile = this.profileService.currentUserProfile();
        if (currentProfile) {
          console.log('Current user profile:', currentProfile);
          if(this.socketChat) {
            this.socketChat.getConversations(currentProfile.id);
          }
        } else {
          console.log('No current user profile found.');
        }
      },
      error: (error) => {
        console.error('Error checking authentication state:', error);
        this.messageService.addMessage({
          content:
            'Error checking authentication state: ' +
            (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  postMessage(message: ChatMessage) {
    if (this.socketChat) {
      this.socketChat.sendMessage(message);
      console.log('Message sent:', message);
    } else {
      console.error('SocketChatService is not initialized.');
      this.messageService.addMessage({
        content: 'SocketChatService is not initialized.',
        type: 'error',
      });
    }
  }

  showModal() {
    const currentValue = this.isModalOpen();
    this.isModalOpen.set(!currentValue);
  }

  isAuthenticated = signal<boolean>(false);

  navigateTo(path: string) {
    // Implement navigation logic here, e.g., using Angular Router
    console.log(`Navigating to ${path}`);
    this.router.navigate([path]);
  }

  loginOutButton() {
    if (this.isAuthenticated()) {
      console.log('Logging out...');
      this.authState.logout();
      this.isAuthenticated.set(false);
      this.router.navigate(['/login']);
    } else {
      console.log('Navigating to login page...');
      this.router.navigate(['/login']);
    }
  }
}
