/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, RouterModule } from '@angular/router';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Observable, Subscription, filter } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './state/auth-state.service';
import {
  AppBarComponent,
  NavSidebarComponent,
  NavItem,
} from '@optimistic-tanuki/navigation-ui';
import { Router } from '@angular/router';
import { ProfileService } from './profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
} from '@optimistic-tanuki/chat-ui';
import {
  ChatService,
  ChatConversation as AppChatConversation,
} from './chat.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
    ChatUiComponent,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  themeName = signal('light-theme');
  themeService = inject(ThemeService);
  urlSub!: Subscription;

  public authState = inject(AuthStateService);
  public profileService = inject(ProfileService);
  public currentUrl$!: Observable<string>;

  private chatService = inject(ChatService);
  private http = inject(HttpClient);

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  title = 'client-interface';
  isNavExpanded = signal(false);
  isAuthenticated = signal(false);
  selectedProfile = signal<ProfileDto | null>(null);
  navItems = signal<NavItem[]>([]);

  chatContacts: ChatContact[] = [];
  chatConversations: ChatConversation[] = [];
  showChat = signal(false);
  chatInitialized = signal(false);

  ngOnInit() {
    this.currentUrl$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects),
      startWith(this.router.url)
    );

    this.authState.isAuthenticated$.subscribe({
      next: (isAuthenticated) => {
        this.isAuthenticated.set(isAuthenticated);
        if (isAuthenticated) {
          this.selectedProfile.set(this.profileService.getCurrentUserProfile());
        }
        this.updateNavItems();
      },
    });

    // Subscribe to currentUrl$ to update active state
    this.currentUrl$.subscribe((url) => {
      this.updateNavItems();
    });

    // Theme is now automatically initialized by ThemeService with CSS variables
    console.log('[AppComponent] Theme initialized via ThemeService');
  }

  ngOnDestroy() {
    if (this.urlSub) {
      this.urlSub.unsubscribe();
    }
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
          label: 'Profile',
          action: () => this.navigateTo('/settings'),
          isActive: currentUrl === '/settings',
        },
        {
          label: 'Feed',
          action: () => this.navigateTo('/feed'),
          isActive: currentUrl === '/feed',
        },
        {
          label: 'Messages',
          action: () => this.navigateTo('/messages'),
          isActive: currentUrl === '/messages',
        },
        {
          label: 'Communities',
          action: () => this.navigateTo('/communities'),
          isActive: currentUrl.startsWith('/communities'),
        },
        {
          label: 'Forum',
          action: () => this.navigateTo('/forum'),
          isActive: currentUrl.startsWith('/forum'),
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
          isActive: currentUrl === '/register',
        },
      ]);
    }
  }

  toggleNav() {
    this.isNavExpanded.set(!this.isNavExpanded());
  }

  navigateTo(path: string) {
    console.log(`Navigating to ${path}`);
    this.router.navigate([path]);
    this.isNavExpanded.set(false);
  }

  toggleChat() {
    this.showChat.update((v) => !v);
    if (this.showChat() && !this.chatInitialized()) {
      this.loadChatData();
    }
  }

  async startChatWithUser(otherProfileId: string) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }

    try {
      const conversation = await this.chatService.startDirectChat(
        currentProfile.id,
        otherProfileId
      );

      this.showChat.set(true);

      if (!this.chatInitialized()) {
        await this.loadChatData();
      }

      const existingContact = this.chatContacts.find(
        (c) => c.id === conversation.id
      );
      if (!existingContact) {
        const profile = await this.fetchProfile(otherProfileId);
        this.chatContacts = [
          ...this.chatContacts,
          {
            id: conversation.id,
            name: profile?.profileName || 'Unknown',
            profilePic: profile?.profilePic,
          },
        ];

        this.chatConversations = [
          ...this.chatConversations,
          {
            id: conversation.id,
            participants: conversation.participants,
            messages: [],
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          },
        ];
      }

      this.openChat(conversation.id);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  }

  async openChat(conversationId: string) {
    const contact = this.chatContacts.find((c) => c.id === conversationId);
    if (contact) {
      this.openChat(contact.id);
    }
  }

  private async fetchProfile(profileId: string): Promise<ProfileDto | null> {
    try {
      return await firstValueFrom(
        this.http.get<ProfileDto>(`/api/profile/${profileId}`)
      );
    } catch {
      return null;
    }
  }

  async loadChatData() {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) return;

    try {
      const conversations: AppChatConversation[] =
        await this.chatService.getConversations(profile.id);

      const allParticipantIds = new Set<string>();
      conversations.forEach((c) => {
        c.participants.forEach((p) => allParticipantIds.add(p));
      });

      const participantIds = Array.from(allParticipantIds);
      if (participantIds.length === 0) {
        this.chatContacts = [];
        this.chatConversations = this.mapConversations(conversations);
        this.chatInitialized.set(true);
        return;
      }

      const profiles = await this.fetchProfiles(participantIds);
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      this.chatContacts = conversations.map((conv) => {
        const otherParticipantId = conv.participants.find(
          (p) => p !== profile.id
        );
        const otherProfile = otherParticipantId
          ? profileMap.get(otherParticipantId)
          : null;

        return {
          id: conv.id,
          name: otherProfile?.profileName || conv.title || 'Unknown',
          profilePic: otherProfile?.profilePic,
        };
      });

      this.chatConversations = this.mapConversations(conversations);
      this.chatInitialized.set(true);
    } catch (err) {
      console.error('Failed to load chat data:', err);
    }
  }

  private mapConversations(
    conversations: AppChatConversation[]
  ): ChatConversation[] {
    return conversations.map((c) => ({
      id: c.id,
      participants: c.participants,
      messages: [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  private async fetchProfiles(profileIds: string[]): Promise<ProfileDto[]> {
    return firstValueFrom(
      this.http.post<ProfileDto[]>('/api/profile/by-ids', { ids: profileIds })
    ) as Promise<ProfileDto[]>;
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
