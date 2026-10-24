import { DestroyRef, Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebSocketSubject } from 'rxjs/webSocket';
import { Notification, CreateNotificationDto } from './notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  private baseUrl = '/api/notifications';
  private ws: WebSocketSubject<Notification> | null = null;
  private activeProfileId: string | null = null;
  private generation = 0;
  private loadSubscription?: Subscription;

  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);

  private notificationSubject = new Subject<Notification>();
  newNotification$ = this.notificationSubject.asObservable();

  constructor() {
    this.connectWebSocket();
    if (typeof window !== 'undefined') {
      const reset = () => {
        this.generation++;
        this.loadSubscription?.unsubscribe();
        this.activeProfileId = null;
        this.notifications.set([]);
        this.unreadCount.set(0);
        this.ws?.complete();
        this.ws = null;
      };
      window.addEventListener('ot:session-reset', reset);
      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('ot:session-reset', reset);
        reset();
      });
    }
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      this.ws = new WebSocketSubject({
        url: `ws://localhost:3000/notifications`,
        deserializer: (e) => JSON.parse(e.data),
      });

      this.ws.subscribe({
        next: (notification) => this.handleNewNotification(notification),
        error: (err) => console.error('Notification WebSocket error:', err),
      });
    } catch (error) {
      console.warn('WebSocket connection failed:', error);
    }
  }

  private handleNewNotification(notification: Notification): void {
    if (
      !this.activeProfileId ||
      notification.recipientId !== this.activeProfileId
    ) {
      return;
    }
    this.notifications.update((list) => [notification, ...list]);
    this.unreadCount.update((count) => count + 1);
    this.notificationSubject.next(notification);
  }

  loadNotifications(profileId: string): void {
    const generation = ++this.generation;
    this.loadSubscription?.unsubscribe();
    this.notifications.set([]);
    this.unreadCount.set(0);
    this.activeProfileId = profileId;
    this.loadSubscription = this.http
      .get<Notification[]>(`${this.baseUrl}/${profileId}`)
      .subscribe({
        next: (notifications) => {
          if (
            generation !== this.generation ||
            profileId !== this.activeProfileId
          )
            return;
          this.notifications.set(notifications);
          this.unreadCount.set(notifications.filter((n) => !n.isRead).length);
        },
        error: (err) => console.error('Failed to load notifications:', err),
      });
  }

  getNotifications(profileId: string): Observable<Notification[]> {
    this.activeProfileId = profileId;
    return this.http.get<Notification[]>(`${this.baseUrl}/${profileId}`);
  }

  getUnreadCount(profileId: string): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${this.baseUrl}/${profileId}/unread-count`
    );
  }

  markAsRead(notificationId: string): Observable<void> {
    const generation = this.generation;
    return this.http
      .put<void>(`${this.baseUrl}/${notificationId}/read`, {})
      .pipe(
        tap(() => {
          if (generation !== this.generation) return;
          this.notifications.update((list) =>
            list.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n
            )
          );
          this.unreadCount.update((count) => Math.max(0, count - 1));
        })
      );
  }

  markAllAsRead(profileId: string): Observable<void> {
    const generation = this.generation;
    this.activeProfileId = profileId;
    return this.http
      .put<void>(`${this.baseUrl}/${profileId}/read-all`, {})
      .pipe(
        tap(() => {
          if (generation !== this.generation) return;
          this.notifications.update((list) =>
            list.map((n) => ({ ...n, isRead: true }))
          );
          this.unreadCount.set(0);
        })
      );
  }

  deleteNotification(notificationId: string): Observable<void> {
    const generation = this.generation;
    return this.http.delete<void>(`${this.baseUrl}/${notificationId}`).pipe(
      tap(() => {
        if (generation !== this.generation) return;
        const currentNotifications = this.notifications();
        const notification = currentNotifications.find(
          (n) => n.id === notificationId
        );
        this.notifications.update((list) =>
          list.filter((n) => n.id !== notificationId)
        );
        if (notification && !notification.isRead) {
          this.unreadCount.update((count) => Math.max(0, count - 1));
        }
      })
    );
  }

  createNotification(data: CreateNotificationDto): Observable<Notification> {
    return this.http.post<Notification>(this.baseUrl, data);
  }
}
