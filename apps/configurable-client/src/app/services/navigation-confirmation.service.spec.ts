import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavigationConfirmationService } from './navigation-confirmation.service';

describe('NavigationConfirmationService', () => {
  let service: NavigationConfirmationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), NavigationConfirmationService],
    });
    service = TestBed.inject(NavigationConfirmationService);
  });

  it('records the first target synchronously and coalesces repeated requests', () => {
    expect(service.requestConfirmation('/owner/desk')).toBeUndefined();
    service.requestConfirmation('/owner/other-target');

    expect(service.isPending()).toBe(true);
    expect(service.pendingTargetUrl).toBe('/owner/desk');
  });

  it('clears the pending target when Stay is selected', () => {
    service.requestConfirmation('/owner/desk');

    service.stay();

    expect(service.isPending()).toBe(false);
    expect(service.pendingTargetUrl).toBeNull();
  });

  it('arms a one-shot bypass and retries the recorded target exactly once', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
    service.requestConfirmation('/owner/desk');

    service.leave();

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/owner/desk');
    expect(service.isPending()).toBe(false);
    expect(service.pendingTargetUrl).toBeNull();
    expect(service.consumeBypass('/owner/desk')).toBe(true);
    expect(service.consumeBypass('/owner/desk')).toBe(false);
    await Promise.resolve();
  });

  it('does not leak a bypass to a different target', () => {
    service.requestConfirmation('/owner/desk');
    service.leave();

    expect(service.consumeBypass('/owner/other-target')).toBe(false);
    expect(service.consumeBypass('/owner/desk')).toBe(true);
  });

  it('starts a new request after Stay clears the previous one', () => {
    service.requestConfirmation('/owner/desk');
    service.stay();

    service.requestConfirmation('/owner/other-target');

    expect(service.pendingTargetUrl).toBe('/owner/other-target');
    expect(service.isPending()).toBe(true);
  });
});
