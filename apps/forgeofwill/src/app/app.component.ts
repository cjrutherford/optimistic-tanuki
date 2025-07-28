import { ButtonComponent, CardComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { Component, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { ChatUiComponent } from '@optimistic-tanuki/chat-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [RouterModule, CardComponent, ButtonComponent, ModalComponent, ThemeToggleComponent, ChatUiComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'forgeofwill';
  isModalOpen = signal<boolean>(false);

  constructor(private readonly router: Router) {}

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
}
