import { Component, effect, signal, OnInit } from '@angular/core';
import {
  MessageComponent,
  MessageService,
  MessageType,
} from '@optimistic-tanuki/message-ui';
import { NavigationEnd, Router, RouterModule } from '@angular/router';

import { AuthStateService } from './auth-state.service';
import {
  ThemeService,
} from '@optimistic-tanuki/theme-lib';
import { ChatComponent } from './chat.component';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile/profile.service';
import { AppBarComponent, NavSidebarComponent, NavItem } from '@optimistic-tanuki/navigation-ui';
import { filter } from 'rxjs';
import { AiAssistantBubbleComponent } from './ai-assistant-bubble/ai-assistant-bubble.component';

@Component({
  imports: [
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
    ChatComponent,
    MessageComponent,
    AiAssistantBubbleComponent,
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

  constructor(
    private readonly router: Router,
    private readonly authState: AuthStateService,
    private readonly profileService: ProfileService,
    private readonly messageService: MessageService,
    private readonly themeService: ThemeService
  ) {
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
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateNavItems();
    });

    this.themeService.themeColors$.subscribe({
      next: (colors) => {
        if (!colors) return;
        const backgroundPattern = `
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="105" viewBox="0 0 80 105">
              <g fill-rule="evenodd">
                  <g id="death-star" fill="${colors.tertiary}" fill-opacity="0.4" fill-rule="nonzero">
                      <path d="M20 10a5 5 0 0 1 10 0v50a5 5 0 0 1-10 0V10zm15 35a5 5 0 0 1 10 0v50a5 5 0 0 1-10 0V45zM20 75a5 5 0 0 1 10 0v20a5 5 0 0 1-10 0V75zm30-65a5 5 0 0 1 10 0v50a5 5 0 0 1-10 0V10zm0 65a5 5 0 0 1 10 0v20a5 5 0 0 1-10 0V75zM35 10a5 5 0 0 1 10 0v20a5 5 0 0 1-10 0V10zM5 45a5 5 0 0 1 10 0v50a5 5 0 0 1-10 0V45zm0-35a5 5 0 0 1 10 0v20a5 5 0 0 1-10 0V10zm60 35a5 5 0 0 1 10 0v50a5 5 0 0 1-10 0V45zm0-35a5 5 0 0 1 10 0v20a5 5 0 0 1-10 0V10z" />
                  </g>
              </g>
          </svg>

      `;
        const encodedPattern = encodeURIComponent(backgroundPattern)
          .replace(/'/g, '%27')
          .replace(/"/g, '%22')
          .replace(/#/g, '%23')
          .replace(/</g, '%3C')
          .replace(/>/g, '%3E')
          .replace(/\s+/g, ' '); // Minimize whitespace

        // Set the encoded SVG as a CSS variable
        document.documentElement.style.setProperty(
          '--background-pattern',
          `url("data:image/svg+xml,${encodedPattern}")`
        );
      },
    });
  }

  updateNavItems() {
    const currentUrl = this.router.url;
    if (this.isAuthenticated()) {
      this.navItems.set([
        {
          label: 'Logout',
          action: () => this.loginOutButton(),
        },
        {
          label: 'Projects',
          action: () => this.navigateTo('/'),
          isActive: currentUrl === '/',
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
      ]);
    } else {
      this.navItems.set([
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
    // TODO: Implement AI assistant conversation opening logic
    // For now, just show a message
    this.messageService.addMessage({
      content: 'AI Assistant chat feature is being implemented...',
      type: 'info',
    });
  }
}
