import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

/**
 * Notification type variants
 */
export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral';

/**
 * Notification position
 */
export type NotificationPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

/**
 * Notification action
 */
export interface NotificationAction {
  label: string;
  callback: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * Notification interface
 */
export interface Notification {
  id: string | number;
  message: string;
  title?: string;
  type?: NotificationType;
  actions?: NotificationAction[];
  read?: boolean;
  icon?: string;
  autoDismiss?: number; // ms, 0 = no auto-dismiss
  closable?: boolean;
}

/**
 * Standardized Notification Component
 *
 * Fully accessible notification/toast system with ARIA live regions and theme support.
 *
 * @example
 * ```html
 * <!-- Single notification -->
 * <otui-notification
 *   [notification]="notification"
 *   [type]="'success'"
 *   [closable]="true"
 *   (dismiss)="onDismiss($event)"
 * ></otui-notification>
 *
 * <!-- Notification bell with dropdown -->
 * <otui-notification
 *   [notifications]="notifications"
 *   [position]="'top-right'"
 *   [showBell]="true"
 *   (notificationCleared)="onClear($event)"
 * ></otui-notification>
 * ```
 */
@Component({
  selector: 'otui-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.theme]': 'theme',
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
export class NotificationComponent
  extends Themeable
  implements OnInit, OnDestroy
{
  // ==================== NEW STANDARD INPUTS ====================

  /** Single notification mode */
  @Input() notification?: Notification;

  /** Multiple notifications (bell mode) */
  @Input() notifications: Notification[] = [];

  /** Notification type (for single mode) */
  @Input() type: NotificationType = 'info';

  /** Toast position */
  @Input() position: NotificationPosition = 'top-right';

  /** Show notification bell icon */
  @Input() showBell = false;

  /** Show unread count badge on bell */
  @Input() showUnreadCount = true;

  /** Show notification icon */
  @Input() showIcon = true;

  /** Allow dismissing notifications */
  @Input() closable = true;

  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  @Input() autoDismiss = 5000;

  /** Show progress bar for auto-dismiss */
  @Input() showProgress = true;

  /** Animation type */
  @Input() animation: 'fade' | 'slide' | 'scale' | 'none' = 'slide';

  /** Maximum number of notifications to show */
  @Input() maxNotifications = 5;

  /** Stack notifications (false = replace) */
  @Input() stack = true;

  /** ARIA live region politeness */
  @Input() ariaLive: 'polite' | 'assertive' = 'polite';

  /** Custom aria-label for the notification region */
  @Input() ariaLabel?: string;

  // ==================== OUTPUTS ====================

  /** Emitted when notification is dismissed */
  @Output() dismiss = new EventEmitter<string | number>();

  /** Emitted when notification is marked as read */
  @Output() notificationRead = new EventEmitter<string | number>();

  /** Emitted when notification action is clicked */
  @Output() actionClicked = new EventEmitter<{
    id: string | number;
    actionIndex: number;
  }>();

  /** Emitted when bell is clicked */
  @Output() bellClick = new EventEmitter<void>();

  // ==================== DEPRECATED INPUTS (Backward Compatibility) ====================

  /**
   * @deprecated Use 'notifications' input instead. Will be removed in v2.0.
   * Legacy placement input
   */
  @Input() set placement(value: 'top' | 'bottom' | 'left' | 'right') {
    console.warn(
      `[otui-notification] Warning: "placement" input is deprecated. Use "position" instead. Will be removed in v2.0.`
    );
    this._legacyPlacement = value;
    this._convertLegacyPlacement(value);
  }
  get placement() {
    return this._legacyPlacement;
  }
  _legacyPlacement: 'top' | 'bottom' | 'left' | 'right' = 'top';

  /**
   * @deprecated Use 'autoDismiss' input instead. Will be removed in v2.0.
   */
  @Input() set autoDismissDefault(value: number) {
    console.warn(
      `[otui-notification] Warning: "autoDismissDefault" input is deprecated. Use "autoDismiss" instead. Will be removed in v2.0.`
    );
    this.autoDismiss = value;
  }

  /**
   * @deprecated Use 'dismiss' output instead. Will be removed in v2.0.
   */
  @Output() set notificationCleared(emitter: EventEmitter<number>) {
    console.warn(
      `[otui-notification] Warning: "notificationCleared" output is deprecated. Use "dismiss" instead. Will be removed in v2.0.`
    );
    this._legacyNotificationCleared = emitter;
    emitter.subscribe((id) => this.dismiss.emit(id));
  }
  _legacyNotificationCleared?: EventEmitter<number>;

  // ==================== INTERNAL STATE ====================

  /** Bell menu visibility */
  menuVisible = false;

  /** Active auto-dismiss timers */
  private dismissTimers = new Map<
    string | number,
    ReturnType<typeof setTimeout>
  >();

  // ==================== GETTERS ====================

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  get hasUnread(): boolean {
    return this.unreadCount > 0;
  }

  get visibleNotifications(): Notification[] {
    const notifications = this.notification
      ? [this.notification]
      : this.notifications;
    return notifications.slice(0, this.maxNotifications);
  }

  get isSingleMode(): boolean {
    return !!this.notification;
  }

  // ==================== LIFECYCLE ====================

  override ngOnInit(): void {
    super.ngOnInit?.();
    this.setupAutoDismiss();
  }

  override ngOnDestroy(): void {
    this.clearAllTimers();
  }

  // ==================== THEME ====================

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.complementary;
    this.transitionDuration = '0.3s';
  }

  // ==================== ACTIONS ====================

  toggleMenu(): void {
    this.menuVisible = !this.menuVisible;
    if (this.menuVisible) {
      this.bellClick.emit();
    }
  }

  dismissNotification(id: string | number): void {
    this.clearTimer(id);

    if (this.notification?.id === id) {
      this.notification = undefined;
    } else {
      this.notifications = this.notifications.filter((n) => n.id !== id);
    }

    this.dismiss.emit(id);

    // Legacy support
    if (this._legacyNotificationCleared) {
      this._legacyNotificationCleared.emit(id as number);
    }
  }

  markAsRead(id: string | number): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
      this.notificationRead.emit(id);
    }
  }

  onActionClick(notification: Notification, actionIndex: number): void {
    const action = notification.actions?.[actionIndex];
    if (action) {
      action.callback();
      this.actionClicked.emit({ id: notification.id, actionIndex });
    }
  }

  dismissAll(): void {
    [...this.notifications].forEach((n) => this.dismissNotification(n.id));
  }

  markAllAsRead(): void {
    this.notifications.forEach((n) => {
      if (!n.read) {
        n.read = true;
        this.notificationRead.emit(n.id);
      }
    });
  }

  // ==================== AUTO-DISMISS ====================

  private setupAutoDismiss(): void {
    this.visibleNotifications.forEach((notification) => {
      const duration = notification.autoDismiss ?? this.autoDismiss;
      if (duration > 0 && notification.closable !== false) {
        this.scheduleDismiss(notification.id, duration);
      }
    });
  }

  private scheduleDismiss(id: string | number, duration: number): void {
    this.clearTimer(id);

    const timer = setTimeout(() => {
      this.dismissNotification(id);
    }, duration);

    this.dismissTimers.set(id, timer);
  }

  private clearTimer(id: string | number): void {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }
  }

  private clearAllTimers(): void {
    this.dismissTimers.forEach((timer) => clearTimeout(timer));
    this.dismissTimers.clear();
  }

  // ==================== UTILITIES ====================

  getTypeIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      neutral: '🔔',
    };
    return icons[type] || '🔔';
  }

  getTypeLabel(type: NotificationType): string {
    const labels: Record<NotificationType, string> = {
      info: 'Information',
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
      neutral: 'Notification',
    };
    return labels[type] || 'Notification';
  }

  trackById(index: number, notification: Notification): string | number {
    return notification.id || index;
  }

  // ==================== LEGACY CONVERSION ====================

  private _convertLegacyPlacement(placement: string): void {
    const mapping: Record<string, NotificationPosition> = {
      top: 'top-right',
      bottom: 'bottom-right',
      left: 'top-left',
      right: 'top-right',
    };
    this.position = mapping[placement] || 'top-right';
  }
}
