import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { InstallService } from './install.service';

/**
 * The browser fires its install offer once, early, and drops it if nothing
 * captures it. A refusal is remembered, because asking twice is how a prompt
 * becomes the thing people block.
 */
describe('InstallService', () => {
  function build(platform: 'browser' | 'server' = 'browser') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(InstallService);
  }

  function offer() {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: jest.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      preventDefault: jest.fn(),
    });
    window.dispatchEvent(event);
    return event;
  }

  beforeEach(() => localStorage.clear());

  it('offers nothing until the browser does', () => {
    expect(build().available()).toBe(false);
  });

  it('offers once the browser has', () => {
    const service = build();

    offer();

    expect(service.available()).toBe(true);
  });

  // Without this the browser shows its own banner on its own schedule.
  it('takes the browser banner over', () => {
    build();

    expect(offer().preventDefault).toHaveBeenCalled();
  });

  it('asks the browser to install when told to', async () => {
    const service = build();
    const event = offer();

    await service.install();

    expect(event.prompt).toHaveBeenCalled();
    expect(service.available()).toBe(false);
  });

  // The event is spent once prompted, whatever the person chose.
  it('does not ask twice on one offer', async () => {
    const service = build();
    const event = offer();

    await service.install();
    await service.install();

    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('stops offering once refused', () => {
    const service = build();
    offer();

    service.dismiss();

    expect(service.available()).toBe(false);
  });

  it('remembers a refusal across visits', () => {
    const service = build();
    offer();
    service.dismiss();

    const next = build();
    offer();

    expect(next.available()).toBe(false);
  });

  it('stops offering once the app is installed', () => {
    const service = build();
    offer();

    window.dispatchEvent(new Event('appinstalled'));

    expect(service.available()).toBe(false);
  });

  // There is no browser on the server, and no install to offer.
  it('does nothing at all when rendered on the server', () => {
    const service = build('server');

    offer();

    expect(service.available()).toBe(false);
  });
});
