import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LocalityDiscoveryResultDto } from '@optimistic-tanuki/models';
import { API_BASE_URL, RadiusScope } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class LocalityDiscoveryService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string
  ) {}

  discoverNearby(
    scope: RadiusScope,
    options: { scope?: string; limit?: number } = {}
  ): Observable<LocalityDiscoveryResultDto> {
    const params = new HttpParams({
      fromObject: {
        lat: String(scope.anchor.lat),
        lng: String(scope.anchor.lng),
        radiusMeters: String(scope.radiusMeters),
        ...(options.scope ? { scope: options.scope } : {}),
        ...(options.limit ? { limit: String(options.limit) } : {}),
      },
    });

    return this.http.get<LocalityDiscoveryResultDto>(
      `${this.apiBaseUrl}/locality/discovery`,
      { params }
    );
  }
}
