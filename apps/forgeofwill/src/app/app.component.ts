import {
  Component,
  computed,
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
import { PersonalityBackdropComponent } from '@optimistic-tanuki/theme-ui';
import { ChatComponent } from './chat.component';
import { ProfileDto, PersonaTelosDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile/profile.service';
import {
  AppBarComponent,
  buildAppShellNavItems,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { filter } from 'rxjs';
import { AiAssistantBubbleComponent } from './ai-assistant-bubble/ai-assistant-bubble.component';
import { ChatMessage } from '@optimistic-tanuki/chat-ui';
import { DevInfoComponent } from '@optimistic-tanuki/common-ui';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { PulseRingsComponent } from '@optimistic-tanuki/motion-ui';

const FORGE_AUTH_NAV_LINKS = [
  {
    label: 'Execution workspace',
    description: 'Project-first planning and execution',
    children: [
      {
        label: 'Projects',
        route: '/projects',
        description: 'Tasks, risks, changes, and journals',
      },
      {
        label: 'Forum',
        route: '/forum',
        description: 'Longer-form discussion and decisions',
      },
    ],
  },
  {
    label: 'Account',
    description: 'Identity and workspace preferences',
    children: [
      {
        label: 'Settings',
        route: '/settings',
        description: 'Profile, personality, and theme controls',
      },
    ],
  },
] as const;

@Component({
  imports: [
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
    ChatComponent,
    MessageComponent,
    AiAssistantBubbleComponent,
    DevInfoComponent,
    HaiAboutTagComponent,
    PulseRingsComponent,
    PersonalityBackdropComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'forgeofwill';
  readonly haiAboutConfig = {
    appId: 'forge-of-will',
    appName: 'Forge of Will',
    appTagline: 'Intentional systems for focused personal workflows.',
    appDescription:
      'Forge of Will helps people shape projects, habits, and personal systems with tools that support deliberate work instead of background churn.',
    appUrl: '/forge-of-will',
  };
  isModalOpen = signal<boolean>(false);
  messages = signal<MessageType[]>([]);
  navItems = signal<NavItem[]>([]);
  currentPath = signal('/');
  newPersonaMessages = signal<Partial<ChatMessage>[]>([]);
  workspaceSummary = computed(() => {
    if (!this.isAuthenticated()) {
      return null;
    }

    const url = this.currentPath();
    if (url.startsWith('/settings')) {
      return {
        eyebrow: 'Settings',
        title: 'Keep the forge recognizable before you return to work',
        description:
          'Profile and personality controls live together so workspace maintenance does not interrupt execution.',
      };
    }
    if (url.startsWith('/forum')) {
      return {
        eyebrow: 'Forum',
        title: 'Use the forum for durable discussion',
        description:
          'Keep project execution in the main workspace and move broader discussion here when it needs structure.',
      };
    }
    return {
      eyebrow: 'Projects',
      title: 'Projects are the primary operating surface',
      description:
        'Pick a project, review its current load, then choose the work mode that matches the next decision or action.',
    };
  });

  @ViewChild(ChatComponent) chatComponent?: ChatComponent;

  private platformId: object = inject(PLATFORM_ID);

  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);
  private readonly themeService = inject(ThemeService);

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get reducedMotion(): boolean {
    if (!this.isBrowser) {
      return true;
    }

    if (typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

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
        this.currentPath.set(this.router.url);
        this.updateNavItems();
      });
    this.currentPath.set(this.router.url);

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
    this.navItems.set(
      buildAppShellNavItems({
        isAuthenticated: this.isAuthenticated(),
        currentUrl: this.currentPath(),
        navigate: (route) => this.navigateTo(route),
        authAction: () => this.loginOutButton(),
        links: [...FORGE_AUTH_NAV_LINKS],
        guestLinks: [
          {
            label: 'Home',
            route: '/',
            description: 'Product overview and entry point',
            exact: true,
          },
          {
            label: 'Register',
            route: '/register',
            description: 'Create your forge workspace',
          },
        ],
      })
    );
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
