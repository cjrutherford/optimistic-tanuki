import {
  ButtonComponent,
  CardComponent,
  ModalComponent,
} from '@optimistic-tanuki/common-ui';
import { Component, effect, signal } from '@angular/core';
import {
  MessageComponent,
  MessageService,
  MessageType,
} from '@optimistic-tanuki/message-ui';
import { Router, RouterModule } from '@angular/router';

import { AuthStateService } from './auth-state.service';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
import { ChatComponent } from './chat.component';

@Component({
  imports: [
    RouterModule,
    CardComponent,
    ButtonComponent,
    ModalComponent,
    ThemeToggleComponent,
    ChatComponent,
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

  constructor(
    private readonly router: Router,
    private readonly authState: AuthStateService,
    private readonly messageService: MessageService,
  ) {
    effect(() => {
      this.messages.set(this.messageService.messages());
      console.log('Messages updated:', this.messages());
    });
  }

  ngOnInit() {
    this.authState.isAuthenticated$().subscribe({
      next: (isAuthenticated) => {
        console.log('Authentication state changed:', isAuthenticated);
        this.isAuthenticated.set(isAuthenticated);
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
