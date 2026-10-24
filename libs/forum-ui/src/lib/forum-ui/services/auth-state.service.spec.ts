import { TestBed } from '@angular/core/testing';
import { AuthStateService } from './auth-state.service';

describe('Forum legacy session state boundary', () => {
  afterEach(() => localStorage.removeItem('auth_token'));
  it('clears decoded legacy identity at the shared session boundary', () => {
    TestBed.configureTestingModule({ providers: [AuthStateService] });
    const state = TestBed.inject(AuthStateService);
    state.setToken(
      btoa('{}') +
        '.' +
        btoa(JSON.stringify({ userId: 'account-a' })) +
        '.fixture'
    );
    expect(state.getCurrentUser()?.userId).toBe('account-a');
    window.dispatchEvent(new Event('ot:session-reset'));
    expect(state.getCurrentUser()).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
