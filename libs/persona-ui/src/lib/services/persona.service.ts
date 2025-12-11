import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL, PersonaTelosDto } from '@optimistic-tanuki/ui-models';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PersonaService {
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);

  /**
   * Get all available personas
   */
  getAllPersonas(): Observable<PersonaTelosDto[]> {
    return this.http.get<PersonaTelosDto[]>(`${this.apiBaseUrl}/persona`);
  }

  /**
   * Get a specific persona by ID
   */
  getPersona(id: string): Observable<PersonaTelosDto> {
    return this.http.get<PersonaTelosDto>(`${this.apiBaseUrl}/persona/${id}`);
  }
}
