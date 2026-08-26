import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { SignInComponent } from './sign-in.component';
import { LearningAuthService } from './learning-auth.service';
import { LearningDataService } from './learning-data.service';

/**
 * The app told people to sign in from three places and had nowhere to do it.
 */
describe('SignInComponent', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LearningDataService,
          useValue: { dashboard: () => of([]) },
        },
      ],
    });
    const fixture = TestBed.createComponent(SignInComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    for (const pending of http.match('/api/learning/me')) pending.flush(null);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, http };
  }

  it('offers a way to sign in', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Email');
    expect(element.textContent).toContain('Password');
    expect(element.textContent).toContain('Login');
  });

  it('offers a way to create an account, since reading needs none', async () => {
    const { fixture, element } = await render();

    expect(element.textContent).toContain('No account yet?');

    fixture.componentInstance.mode.set('register');
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('register');
    expect(element.textContent).toContain('Already have one?');
  });

  it('sends the credentials and goes on to the catalog', async () => {
    const { fixture, http } = await render();
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');

    fixture.componentInstance.signIn({
      email: 'ada@example.com',
      password: 'secret',
    });
    const request = http.expectOne('/api/authentication/login');
    expect(request.request.body).toEqual({
      email: 'ada@example.com',
      password: 'secret',
    });
    request.flush({});

    // /courses, not /. Somebody who has just signed in has already been
    // sold; sending them back to the landing page makes the pitch twice.
    expect(navigate).toHaveBeenCalledWith('/courses');
  });

  // The gateway answers 500 for a wrong password, which is not something to
  // put in front of a person as "internal server error".
  it('says the credentials did not match rather than reporting a fault', async () => {
    const { fixture, http } = await render();

    fixture.componentInstance.signIn({ email: 'a@b.c', password: 'wrong' });
    http
      .expectOne('/api/authentication/login')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(fixture.componentInstance.error()).toContain('do not match');
  });

  it('maps the form fields onto what the service actually expects', async () => {
    const { fixture, http } = await render();

    fixture.componentInstance.register({
      email: 'grace@example.com',
      password: 'secret',
      confirmation: 'secret',
      firstName: 'Grace',
      lastName: 'Hopper',
    });

    expect(http.expectOne('/api/authentication/register').request.body).toEqual(
      {
        email: 'grace@example.com',
        password: 'secret',
        confirm: 'secret',
        fn: 'Grace',
        ln: 'Hopper',
        bio: '',
      }
    );
  });

  // Registering does not sign anyone in, and asking for the same password a
  // second time would be a poor welcome.
  it('signs a new account in with what was just typed', async () => {
    const { fixture, http } = await render();

    fixture.componentInstance.register({
      email: 'grace@example.com',
      password: 'secret',
      confirmation: 'secret',
      firstName: 'Grace',
      lastName: 'Hopper',
    });
    http.expectOne('/api/authentication/register').flush({});

    expect(http.expectOne('/api/authentication/login').request.body).toEqual({
      email: 'grace@example.com',
      password: 'secret',
    });
  });

  it('says plainly when the email is taken', async () => {
    const { fixture, http } = await render();

    fixture.componentInstance.register({
      email: 'ada@example.com',
      password: 'secret',
      confirmation: 'secret',
      firstName: 'Ada',
      lastName: 'L',
    });
    http
      .expectOne('/api/authentication/register')
      .flush(null, { status: 409, statusText: 'Conflict' });

    expect(fixture.componentInstance.error()).toContain('already an account');
  });
});

describe('LearningAuthService', () => {
  function service() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      auth: TestBed.inject(LearningAuthService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('reports who is signed in', async () => {
    const { auth, http } = service();
    const seen = jest.fn();

    auth.me().subscribe(seen);
    http.expectOne('/api/learning/me').flush({ name: 'Ada Lovelace' });

    expect(seen).toHaveBeenCalledWith({ name: 'Ada Lovelace' });
  });

  it('reports nobody for an anonymous visitor', async () => {
    const { auth, http } = service();
    const seen = jest.fn();

    auth.me().subscribe(seen);
    http.expectOne('/api/learning/me').flush(null);

    expect(seen).toHaveBeenCalledWith(null);
  });

  // The header renders for everyone, so a failure here must not break it.
  it('reports nobody rather than failing when the call does', async () => {
    const { auth, http } = service();
    const seen = jest.fn();

    auth.me().subscribe(seen);
    http
      .expectOne('/api/learning/me')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(seen).toHaveBeenCalledWith(null);
  });

  /**
   * A cached lesson is keyed by URL and nothing else, so a draft only its
   * author may read would otherwise sit in the browser cache for whoever
   * signs in next on the same machine.
   */
  describe('cached content and who is asking', () => {
    const originalCaches = (globalThis as { caches?: unknown }).caches;

    afterEach(() => {
      (globalThis as { caches?: unknown }).caches = originalCaches;
    });

    function fakeCaches(names: string[]) {
      const deleted: string[] = [];
      (globalThis as { caches?: unknown }).caches = {
        keys: async () => names,
        delete: async (name: string) => {
          deleted.push(name);
          return true;
        },
      };
      return deleted;
    }

    it('forgets cached lessons when somebody signs out', async () => {
      const deleted = fakeCaches(['ngsw:1:data:lessons', 'unrelated']);
      const { auth, http } = service();

      auth.logout().subscribe();
      http.expectOne('/api/authentication/logout').flush({});
      await Promise.resolve();
      await Promise.resolve();

      expect(deleted).toContain('ngsw:1:data:lessons');
      expect(deleted).not.toContain('unrelated');
    });

    it('forgets them when somebody else signs in', async () => {
      const deleted = fakeCaches(['ngsw:1:data:lessons']);
      const { auth, http } = service();

      auth.login('grace@example.com', 'secret').subscribe();
      http.expectOne('/api/authentication/login').flush({});
      await Promise.resolve();
      await Promise.resolve();

      expect(deleted).toContain('ngsw:1:data:lessons');
    });

    it('does not fall over in a browser with no cache store', async () => {
      delete (globalThis as { caches?: unknown }).caches;
      const { auth } = service();

      await expect(auth.forgetCachedContent()).resolves.toBeUndefined();
    });
  });

  it('does not fail a sign-out the server refused', async () => {
    const { auth, http } = service();
    const done = jest.fn();

    auth.logout().subscribe({ next: done });
    http
      .expectOne('/api/authentication/logout')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(done).toHaveBeenCalled();
  });
});
