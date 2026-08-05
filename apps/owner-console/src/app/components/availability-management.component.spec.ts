import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StoreService } from '../services/store.service';
import { AvailabilityManagementComponent } from './availability-management.component';

describe('AvailabilityManagementComponent', () => {
  let storeService: { getAvailabilities: jest.Mock };
  let authService: { getSessionUser: jest.Mock };

  beforeEach(async () => {
    storeService = {
      getAvailabilities: jest.fn().mockReturnValue(of([])),
    };
    authService = {
      getSessionUser: jest.fn().mockReturnValue({ userId: 'user-123' }),
    };

    await TestBed.configureTestingModule({
      imports: [AvailabilityManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('prefills the availability owner from the restored cookie session', () => {
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    const component = fixture.componentInstance;

    component.openCreateModal();

    expect(component.createForm.ownerId).toBe('user-123');
    expect(component.showCreateModal).toBe(true);
  });

  it('blocks availability creation when the restored session has no user id', () => {
    authService.getSessionUser.mockReturnValue({ profileId: 'profile-1' });
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    const component = fixture.componentInstance;

    component.openCreateModal();

    expect(component.showCreateModal).toBe(false);
    expect(component.error).toBe(
      'Unable to determine operator identity for availability creation.'
    );
  });

  it('renders availability rows through the shared ag-grid table', () => {
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-ag-grid')).toBeTruthy();
  });
});
