import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthStateService } from '../../services/auth-state.service';
import { TownSourcesService } from '../../services/town-sources.service';
import { TownSourcesNoteComponent } from './town-sources-note.component';

interface TownSourcesDouble {
  request: jest.Mock;
}

interface AuthDouble {
  isAuthenticated$: Observable<boolean>;
  waitForSessionRestore: jest.Mock;
}

describe('TownSourcesNoteComponent', () => {
  let sources: TownSourcesDouble;
  let router: Router;
  let navigate: jest.SpyInstance;

  async function render(
    signedIn: boolean,
    status: 'no-sources' | 'not-sourced-yet' = 'no-sources'
  ): Promise<ComponentFixture<TownSourcesNoteComponent>> {
    sources = { request: jest.fn() };
    const auth: AuthDouble = {
      isAuthenticated$: of(signedIn),
      waitForSessionRestore: jest.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [TownSourcesNoteComponent],
      providers: [
        provideRouter([]),
        { provide: TownSourcesService, useValue: sources },
        { provide: AuthStateService, useValue: auth },
      ],
    });
    router = TestBed.inject(Router);
    navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TownSourcesNoteComponent);
    fixture.componentRef.setInput('citySlug', 'adel');
    fixture.componentRef.setInput('localitySlug', 'adel-ga');
    fixture.componentRef.setInput('name', 'Adel');
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ComponentFixture<TownSourcesNoteComponent>) =>
    f.nativeElement as HTMLElement;

  async function open(f: ComponentFixture<TownSourcesNoteComponent>) {
    (el(f).querySelector('button.primary') as HTMLButtonElement).click();
    await f.whenStable();
    f.detectChanges();
  }

  async function send(f: ComponentFixture<TownSourcesNoteComponent>) {
    el(f).querySelector('form')?.dispatchEvent(new Event('submit'));
    await f.whenStable();
    f.detectChanges();
  }

  it('links Partner with us to /contact with the town', async () => {
    const f = await render(false);
    const link = el(f).querySelectorAll('a.action')[0] as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/contact?town=Adel');
  });

  it('links Post sources to /contribute and back to the page', async () => {
    const f = await render(false);
    const link = el(f).querySelectorAll('a.action')[1] as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      '/contribute?returnUrl=%2Fcity%2Fadel%2Fbriefing'
    );
  });

  it('sends a signed-out reader to login with a return URL', async () => {
    const f = await render(false);
    await open(f);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/city/adel/briefing' },
    });
    expect(el(f).querySelector('textarea')).toBeNull();
  });

  it('labels the textarea and shows the character limit', async () => {
    const f = await render(true);
    await open(f);
    const area = el(f).querySelector('textarea') as HTMLTextAreaElement;
    expect(area.closest('label')).not.toBeNull();
    expect(area.getAttribute('maxlength')).toBe('500');
    expect(el(f).textContent).toContain('0 / 500 characters');
  });

  it('posts the request with the note and confirms', async () => {
    const f = await render(true);
    sources.request.mockResolvedValue({
      requestCount: 5,
      alreadyRequested: false,
    });
    await open(f);
    const area = el(f).querySelector('textarea') as HTMLTextAreaElement;
    area.value = 'The county posts agendas online';
    area.dispatchEvent(new Event('input'));
    await send(f);
    expect(sources.request).toHaveBeenCalledWith(
      'adel-ga',
      'The county posts agendas online'
    );
    const confirmation = el(f).querySelector('[aria-live="polite"]');
    expect(confirmation?.textContent).toContain(
      'Thanks — 5 readers have asked for Adel'
    );
  });

  it('shows the same confirmation when the reader already asked', async () => {
    const f = await render(true);
    sources.request.mockResolvedValue({
      requestCount: 3,
      alreadyRequested: true,
    });
    await open(f);
    await send(f);
    expect(sources.request).toHaveBeenCalledWith('adel-ga', undefined);
    expect(el(f).querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Thanks — 3 readers have asked for Adel'
    );
  });

  it('tells the reader when the request fails', async () => {
    const f = await render(true);
    sources.request.mockRejectedValue(new HttpErrorResponse({ status: 500 }));
    await open(f);
    await send(f);
    expect(el(f).querySelector('[role="alert"]')?.textContent).toContain(
      "couldn't send your request"
    );
  });

  it('sends the reader to login when the session has lapsed', async () => {
    const f = await render(true);
    sources.request.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    await open(f);
    await send(f);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/city/adel/briefing' },
    });
  });
});
