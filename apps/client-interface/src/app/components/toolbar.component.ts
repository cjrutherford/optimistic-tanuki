import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { filter, Subscription } from 'rxjs';
import { UserComponent } from './user/user.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, ThemeToggleComponent, UserComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent implements OnDestroy {
  @Output() navToggle = new EventEmitter<void>();
  themeSub: Subscription;
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  constructor(private readonly themeService: ThemeService) {
    this.themeSub = this.themeService.themeColors$.pipe(filter(v => !!v)).subscribe((colors) => {
      this.themeStyles = {
        backgroundColor: colors.background,
        color: colors.foreground,
        border: `1px solid ${colors.accent}`,

      };
    });
  }

  ngOnDestroy() {
    this.themeSub.unsubscribe();
  } 

  emit() {
    this.navToggle.emit();
  }
}
