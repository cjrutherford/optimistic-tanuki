import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY, Observable, catchError, map, of, tap } from 'rxjs';

export interface SignedInPerson {
  name: string;
}

/**
 * Signing in and out of the learning app.
 *
 * The session is an httpOnly cookie, so nothing here holds a token and the
 * client cannot read one. Whether somebody is signed in is answered by asking
 * the gateway, not by looking in storage.
 */
@Injectable({ providedIn: 'root' })
export class LearningAuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  login(email: string, password: string): Observable<unknown> {
    return (
      this.http
        .post('/api/authentication/login', { email, password })
        // Whoever was here before is not who is here now.
        .pipe(tap(() => this.forgetCachedContent()))
    );
  }

  register(input: {
    email: string;
    password: string;
    confirmation: string;
    firstName: string;
    lastName: string;
    bio?: string;
  }): Observable<unknown> {
    // The service names these fields differently from the shared form block,
    // which is why this mapping is here rather than in the component.
    return this.http.post('/api/authentication/register', {
      email: input.email,
      password: input.password,
      confirm: input.confirmation,
      fn: input.firstName,
      ln: input.lastName,
      bio: input.bio ?? '',
    });
  }

  logout(): Observable<unknown> {
    return this.http.post('/api/authentication/logout', {}).pipe(
      // Signing out should not fail visibly. Whatever the server says, the
      // person asked to leave.
      catchError(() => of(null)),
      tap(() => this.forgetCachedContent())
    );
  }

  /**
   * Drops anything the service worker cached for the person who was here.
   *
   * A cached lesson is keyed by its URL and nothing else, so a draft that
   * only its author may read would otherwise still be sitting there for
   * whoever signs in next on the same browser. Signing in and out are the
   * only moments the answer to "who is asking" changes.
   */
  async forgetCachedContent(): Promise<void> {
    if (!this.isBrowser || typeof caches === 'undefined') return;
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.includes('ngsw') || name.includes('lessons'))
          .map((name) => caches.delete(name))
      );
    } catch {
      // A browser that refuses to open its cache store has nothing to leak
      // from it either.
    }
  }

  /**
   * Who is signed in, or nothing.
   *
   * Answered from the learning profile, which every signed-in visitor has by
   * the time they have touched anything, and which carries the name a course
   * is attributed to.
   */
  me(): Observable<SignedInPerson | null> {
    if (!this.isBrowser) return EMPTY;
    return this.http.get<{ name?: string }>('/api/learning/me').pipe(
      map((profile) => (profile?.name ? { name: profile.name } : null)),
      catchError(() => of(null))
    );
  }
}
