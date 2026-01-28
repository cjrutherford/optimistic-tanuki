import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs'
import { AuthStateService } from './auth-state.service';

@Injectable({
    providedIn: 'root',
})
export class UserPermissionsService {
    private readonly baseUrl = 'api/permissions';
    private http: HttpClient = inject(HttpClient);
    private authState: AuthStateService = inject(AuthStateService);

    /**
     * get the roles for a user based on optional app scope
     * @param appScope
     * @returns
     */
    getUserRoles(appScope?: string): Observable<any> {
        const profile = this.authState.getDecodedTokenValue();
        if (!profile?.profileId) {
            throw new Error('No profile id found');
        }
        const profileId = profile.profileId;
        let params = new HttpParams();
        if (appScope) {
            params = params.set('appScope', appScope);
        }
        return this.http.get(`${this.baseUrl}/user-roles/${profileId}`, { params });
    }



    checkPermission(data: {
        permission: string;
        appScope: string;
        targetId: string;
    }): Observable<boolean> {
        return this.http.post<boolean>(`${this.baseUrl}/check-permission`, data);
    }

    searchPermissions(startsWith: string): Promise<string[]> {
        const params = new HttpParams().set('startsWith', startsWith);
        return firstValueFrom(this.http.get<string[]>(`${this.baseUrl}/permission-search`, { params }));
    }
}
