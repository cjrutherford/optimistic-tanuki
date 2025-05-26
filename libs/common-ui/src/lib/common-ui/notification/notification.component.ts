import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

interface Notification {
  id: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
  actions: { label: string, callback: () => void }[];
  read: boolean;
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
  menuVisible = false;

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  toggleMenu() {
    this.menuVisible = !this.menuVisible;
  }

  clearNotification(id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  markAsRead(id: number) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }
}
