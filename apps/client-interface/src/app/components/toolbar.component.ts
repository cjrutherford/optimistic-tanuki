import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeToggleComponent, ThemeService } from '@optimistic-tanuki/theme-ui';
import { filter, Subscription } from 'rxjs';
import { UserComponent } from './user/user.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, ThemeToggleComponent, UserComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
/**
 * Component for the application toolbar.
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, ThemeToggleComponent, UserComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent implements OnDestroy {
  /**
   * Emits an event when the navigation toggle button is clicked.
   */
  @Output() navToggle = new EventEmitter<void>();
  /**
   * Subscription for theme changes.
   */
  themeSub: Subscription;
  /**
   * Styles for the component based on the current theme.
   */
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  /**
   * Creates an instance of ToolbarComponent.
   * @param themeService The service for managing themes.
   */
  constructor(private readonly themeService: ThemeService) {
    this.themeSub = this.themeService.themeColors$.pipe(filter(v => !!v)).subscribe((colors) => {
      this.themeStyles = {
        backgroundColor: colors.background,
        color: colors.foreground,
        border: `1px solid ${colors.accent}`,

      };
    });
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    this.themeSub.unsubscribe();
  } 

  /**
   * Emits the `navToggle` event.
   */
  emit() {
    this.navToggle.emit();
  }
}
