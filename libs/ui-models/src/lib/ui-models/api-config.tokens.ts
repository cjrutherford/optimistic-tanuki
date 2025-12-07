import { InjectionToken } from '@angular/core';

/**
 * Injection token for the API base URL.
 * Each Angular application must provide a value for this token in their app.config.ts or AppModule.
 * 
 * @example
 * // In app.config.ts:
 * import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     {
 *       provide: API_BASE_URL,
 *       useValue: '/api' // or useFactory for dynamic values
 *     },
 *     // ... other providers
 *   ]
 * };
 * 
 * // In a service:
 * import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
 * 
 * @Injectable({ providedIn: 'root' })
 * export class MyService {
 *   constructor(
 *     @Inject(API_BASE_URL) private apiBaseUrl: string,
 *     private http: HttpClient
 *   ) {}
 * }
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
