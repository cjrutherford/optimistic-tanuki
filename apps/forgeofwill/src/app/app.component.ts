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
import { ChatComponent } from './chat.component';

/**
 * The root component of the Forge of Will application.
 */
@Component({
  standalone: true,
  imports: [
    RouterModule,
    CardComponent,
    ButtonComponent,
    ModalComponent,
    ThemeToggleComponent,
    MessageComponent,
    ChatComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  /**
   * The title of the application.
   */
  title = 'forgeofwill';
  /**
   * A signal that indicates whether the modal window is open.
   */
  isModalOpen = signal<boolean>(false);
  /**
   * A signal that holds an array of messages to be displayed.
   */
  messages = signal<MessageType[]>([]);
  /**
   * The WebSocket service for chat functionality.
   */
  socketChat?: SocketChatService;

  /**
   * Creates an instance of the AppComponent.
   * @param platformId The platform ID.
   * @param router The Angular router.
   * @param authState The authentication state service.
   * @param messageService The message service for displaying notifications.
   * @param profileService The service for managing user profiles.
   */
  constructor(
    private readonly router: Router,
    private readonly authState: AuthStateService,
    private readonly messageService: MessageService,
    private readonly profileService: ProfileService
  ) {
    effect(() => {
      this.messages.set(this.messageService.messages());
      console.log('Messages updated:', this.messages());
    });
  }

  /**
   * Initializes the component.
   */
  ngOnInit() {
    this.authState.isAuthenticated$().subscribe({
      next: (isAuthenticated) => {
        console.log('Authentication state changed:', isAuthenticated);
        this.isAuthenticated.set(isAuthenticated);
        const currentProfile = this.profileService.currentUserProfile();
        if (currentProfile) {
          console.log('Current user profile:', currentProfile);
          if (this.socketChat) {
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



  /**
   * Toggles the visibility of the modal window.
   */
  showModal() {
    const currentValue = this.isModalOpen();
    this.isModalOpen.set(!currentValue);
  }

  /**
   * A signal that indicates whether the user is authenticated.
   */
  isAuthenticated = signal<boolean>(false);

  /**
   * Navigates to the specified path.
   * @param path The path to navigate to.
   */
  navigateTo(path: string) {
    // Implement navigation logic here, e.g., using Angular Router
    console.log(`Navigating to ${path}`);
    this.router.navigate([path]);
  }

  /**
   * Handles the login/logout button click.
   */
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
