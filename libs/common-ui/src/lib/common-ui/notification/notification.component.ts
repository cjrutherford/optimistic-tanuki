import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

export type NotificationVariant = 'info' | 'warning' | 'error' | 'success' | 'neutral';
export interface Notification {
  id: number;
  message: string;
  variant?: NotificationVariant;
  actions?: { label: string, callback: () => void }[];
  read?: boolean;
  icon?: string;
  autoDismiss?: number; // ms
  placement?: 'top' | 'bottom' | 'left' | 'right';
}
@Component({
  selector: 'otui-notification',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
})
export class NotificationComponent {
  @Input() notifications: Notification[] = [];
  @Input() placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() showIcon = true;
  @Input() showUnreadCount = true;
  @Input() animation: 'fade' | 'slide' | 'none' = 'fade';
  @Input() autoDismissDefault = 0;
  @Output() notificationCleared = new EventEmitter<number>();
  @Output() notificationRead = new EventEmitter<number>();
  menuVisible = false;

  get unreadCount(): number {
    return this.notifications ? this.notifications.filter(n => !n.read).length : 0;
  }

  toggleMenu() {
    this.menuVisible = !this.menuVisible;
  }

  clearNotification(id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notificationCleared.emit(id);
  }

  markAsRead(id: number) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notificationRead.emit(id);
    }
  }

  ngAfterViewInit() {
    // Auto-dismiss notifications if set
    this.notifications.forEach(n => {
      if (n.autoDismiss || this.autoDismissDefault) {
        setTimeout(() => this.clearNotification(n.id), n.autoDismiss || this.autoDismissDefault);
      }
    });
  }
}