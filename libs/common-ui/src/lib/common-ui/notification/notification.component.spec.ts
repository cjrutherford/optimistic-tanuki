import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationComponent } from './notification.component';

describe('NotificationComponent', () => {
  let component: NotificationComponent;
  let fixture: ComponentFixture<NotificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate unreadCount correctly', () => {
    component.notifications = [
      { id: 1, message: 'Test 1', variant: 'info', actions: [], read: false },
      { id: 2, message: 'Test 2', variant: 'info', actions: [], read: true },
      { id: 3, message: 'Test 3', variant: 'info', actions: [], read: false },
    ];
    expect(component.unreadCount).toBe(2);
  });

  it('should toggle menuVisible', () => {
    expect(component.menuVisible).toBeFalsy();
    component.toggleMenu();
    expect(component.menuVisible).toBeTruthy();
    component.toggleMenu();
    expect(component.menuVisible).toBeFalsy();
  });

  it('should clear notification by id', () => {
    component.notifications = [
      { id: 1, message: 'Test 1', variant: 'info', actions: [], read: false },
      { id: 2, message: 'Test 2', variant: 'info', actions: [], read: true },
    ];
    component.clearNotification(1);
    expect(component.notifications.length).toBe(1);
    expect(component.notifications[0].id).toBe(2);
  });

  it('should mark notification as read by id', () => {
    component.notifications = [
      { id: 1, message: 'Test 1', variant: 'info', actions: [], read: false },
    ];
    component.markAsRead(1);
    expect(component.notifications[0].read).toBeTruthy();
  });

  it('should not mark as read if notification not found', () => {
    component.notifications = [
      { id: 1, message: 'Test 1', variant: 'info', actions: [], read: false },
    ];
    component.markAsRead(99);
    expect(component.notifications[0].read).toBeFalsy();
  });
});
