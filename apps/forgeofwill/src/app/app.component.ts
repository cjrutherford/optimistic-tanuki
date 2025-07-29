import { ButtonComponent, CardComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { Component, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { AuthStateService } from './auth-state.service';
import { ChatUiComponent } from '@optimistic-tanuki/chat-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [RouterModule, CardComponent, ButtonComponent, ModalComponent, ThemeToggleComponent, ChatUiComponent],
  providers: [AuthStateService],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'forgeofwill';
  isModalOpen = signal<boolean>(false);

  constructor(private readonly router: Router, private readonly authState: AuthStateService) {}

  ngOnInit() {
    this.authState.isAuthenticated$.subscribe({
      next: (isAuthenticated) => {
        console.log('Authentication state changed:', isAuthenticated);
        this.isAuthenticated.set(isAuthenticated);
      },
      error: (error) => {
        console.error('Error checking authentication state:', error);
      }
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
    this.router.navigate([path])
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
