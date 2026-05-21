import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StoreService } from '../services/store.service';
import { AvailabilityManagementComponent } from './availability-management.component';

function createToken(payload: object): string {
  return [
    'header',
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.');
}

describe('AvailabilityManagementComponent', () => {
  let storeService: { getAvailabilities: jest.Mock };
  let authService: { getToken: jest.Mock };

  beforeEach(async () => {
    storeService = {
      getAvailabilities: jest.fn().mockReturnValue(of([])),
    };
    authService = {
      getToken: jest.fn().mockReturnValue(createToken({ userId: 'user-123' })),
    };

    await TestBed.configureTestingModule({
      imports: [AvailabilityManagementComponent],
      providers: [
        { provide: StoreService, useValue: storeService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('prefills the availability owner from the authenticated token', () => {
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    const component = fixture.componentInstance;

    component.openCreateModal();

    expect(component.createForm.ownerId).toBe('user-123');
    expect(component.showCreateModal).toBe(true);
  });

  it('blocks availability creation when the auth token has no user id', () => {
    authService.getToken.mockReturnValue(createToken({ profileId: 'profile-1' }));
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    const component = fixture.componentInstance;

    component.openCreateModal();

    expect(component.showCreateModal).toBe(false);
    expect(component.error).toBe('Unable to determine operator identity for availability creation.');
  });
});
