import {
  Component,
  effect,
  signal,
  OnInit,
  ViewChild,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  MessageComponent,
  MessageService,
  MessageType,
} from '@optimistic-tanuki/message-ui';
import { NavigationEnd, Router, RouterModule } from '@angular/router';

import { AuthStateService } from './auth-state.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ChatComponent } from './chat.component';
import { ProfileDto, PersonaTelosDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile/profile.service';
import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { filter } from 'rxjs';
import { AiAssistantBubbleComponent } from './ai-assistant-bubble/ai-assistant-bubble.component';
import { ChatMessage } from '@optimistic-tanuki/chat-ui';
import { DevInfoComponent } from '@optimistic-tanuki/common-ui';

@Component({
  imports: [
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
    ChatComponent,
    MessageComponent,
    AiAssistantBubbleComponent,
    DevInfoComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'forgeofwill';
  isModalOpen = signal<boolean>(false);
  messages = signal<MessageType[]>([]);
  navItems = signal<NavItem[]>([]);
  newPersonaMessages = signal<Partial<ChatMessage>[]>([]);

  @ViewChild(ChatComponent) chatComponent?: ChatComponent;

  private platformId: object = inject(PLATFORM_ID);

  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);
  private readonly themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      this.messages.set(this.messageService.messages());
      console.log('Messages updated:', this.messages());
      this.selectedProfile.set(this.profileService.currentUserProfile());
    });
  }

  ngOnInit() {
    this.authState.isAuthenticated$().subscribe({
      next: (isAuthenticated) => {
        console.log('Authentication state changed:', isAuthenticated);
        this.isAuthenticated.set(isAuthenticated);
        this.selectedProfile.set(this.profileService.getCurrentUserProfile());
        this.updateNavItems();
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

    // Subscribe to router events to update active state
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateNavItems();
      });

    // Initialize theme - only in browser to avoid SSR issues
    if (isPlatformBrowser(this.platformId)) {
      // Set fixed Bold personality with clean professional + energetic accent
      // No theme selection UI - this is the brand identity
      this.themeService.setPersonality('bold');
      this.themeService.setPrimaryColor('#0EA5E9'); // Sky blue - energetic, productive, action-oriented

      console.log('[Forge of Will] Theme initialized with Bold personality');
    }
  }

  updateNavItems() {
    const currentUrl = this.router.url;
    if (this.isAuthenticated()) {
      this.navItems.set([
        {
          label: 'Home',
          action: () => this.navigateTo('/'),
          isActive: currentUrl === '/',
        },
        {
          label: 'Projects',
          action: () => this.navigateTo('/projects'),
          isActive: currentUrl === '/projects',
        },
        {
          label: 'Forum',
          action: () => this.navigateTo('/forum'),
          isActive: currentUrl.startsWith('/forum'),
        },
        {
          label: 'My Profile',
          action: () => this.navigateTo('/profile'),
          isActive: currentUrl === '/profile',
        },
        {
          label: 'Settings',
          action: () => this.navigateTo('/settings'),
          isActive: currentUrl === '/settings',
        },
        {
          label: 'Logout',
          action: () => this.loginOutButton(),
        },
      ]);
    } else {
      this.navItems.set([
        {
          label: 'Home',
          action: () => this.navigateTo('/'),
          isActive: currentUrl === '/',
        },
        {
          label: 'Login',
          action: () => this.loginOutButton(),
        },
        {
          label: 'Register',
          action: () => this.navigateTo('/register'),
        },
      ]);
    }
  }

  showModal() {
    const currentValue = this.isModalOpen();
    this.isModalOpen.set(!currentValue);
  }

  isAuthenticated = signal<boolean>(false);
  selectedProfile = signal<ProfileDto | null>(null);

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

  openAiAssistant() {
    console.log('Opening AI Assistant chat...');
    if (this.chatComponent) {
      this.chatComponent.openAiAssistantChat();
    } else {
      console.error('Chat component not available');
      this.messageService.addMessage({
        content: 'Chat service is not available',
        type: 'error',
      });
    }
  }

  onPersonaSelected(persona: PersonaTelosDto) {
    console.log('Persona selected:', persona);
    if (this.chatComponent) {
      this.chatComponent.openOrCreatePersonaChat(persona.id);
    } else {
      console.error('Chat component not available');
      this.messageService.addMessage({
        content: 'Chat service is not available',
        type: 'error',
      });
      this.newPersonaMessages.set([
        {
          content: `Persona "${persona.name}" selected, Please introduce the user to your role.`,
          type: 'system',
          recipientId: [persona.id],
          senderId:
            this.authState.getPersistedSelectedProfile()?.id || 'system',
        },
      ]);
    }
  }
}
