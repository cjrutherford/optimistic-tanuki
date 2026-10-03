import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { LocalHubMembership } from '@optimistic-tanuki/models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { map, type Observable } from 'rxjs';

/**
 * The signed-in account's standing here: its handle, roles and permissions.
 * The handle and bio are edited on the local-hub profile, not here.
 */
@Injectable({ providedIn: 'root' })
export class MembershipService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/local-hub/me`;

  me(): Observable<LocalHubMembership> {
    return this.http
      .get<{ data: LocalHubMembership }>(this.base)
      .pipe(map((response) => response.data));
  }
}
