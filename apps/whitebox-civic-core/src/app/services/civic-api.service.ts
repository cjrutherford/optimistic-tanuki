import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  CivicAgendaDto,
  EmergencyBroadcastDto,
  TipProjectSpatialDto,
} from '@optimistic-tanuki/models';

@Injectable({
  providedIn: 'root',
})
export class CivicApiService {
  private readonly baseUrl = '/api/v1/civic';

  constructor(private readonly http: HttpClient) {}

  getAgendas(
    options: {
      meetingBody?: string;
      search?: string;
    } = {}
  ): Observable<CivicAgendaDto[]> {
    const params: Record<string, string> = {};
    if (options.meetingBody) {
      params['meetingBody'] = options.meetingBody;
    }
    if (options.search?.trim()) {
      params['search'] = options.search.trim();
    }
    return this.http.get<CivicAgendaDto[]>(`${this.baseUrl}/agendas`, {
      params,
    });
  }

  getTipProjects(bbox?: string): Observable<TipProjectSpatialDto[]> {
    const params: Record<string, string> = {};
    if (bbox) {
      params['bbox'] = bbox;
    }
    return this.http.get<TipProjectSpatialDto[]>(
      `${this.baseUrl}/tip-projects`,
      { params }
    );
  }

  getTipProject(id: string): Observable<TipProjectSpatialDto> {
    return this.http.get<TipProjectSpatialDto>(
      `${this.baseUrl}/tip-projects/${encodeURIComponent(id)}`
    );
  }

  watchBroadcasts(): Observable<EmergencyBroadcastDto[]> {
    return new Observable<EmergencyBroadcastDto[]>((subscriber) => {
      const source = new EventSource(`${this.baseUrl}/broadcasts/stream`);
      source.onmessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as {
            broadcasts?: EmergencyBroadcastDto[];
          };
          subscriber.next(
            Array.isArray(payload.broadcasts) ? payload.broadcasts : []
          );
        } catch {
          // Ignore malformed events and retain the most recent public notice.
        }
      };
      // EventSource reconnects on its own. A transient disconnect must not hide
      // an advisory that remains active on the server.
      source.onerror = () => undefined;
      return () => source.close();
    }).pipe(catchError(() => of([])));
  }
}
