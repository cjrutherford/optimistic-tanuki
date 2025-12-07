import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginRequest, RegisterRequest, UserDto } from '@optimistic-tanuki/ui-models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';


@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  isAuthenticated: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  userData: BehaviorSubject<UserDto | null> = new BehaviorSubject<UserDto | null>(null);
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private readonly http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/authentication`;
  }

  isAuthenticated$() {
    return this.isAuthenticated.asObservable();
  }

  register(data: RegisterRequest) {
    return this.http.post(`${this.baseUrl}/register`, data);
  } 

  login(data: LoginRequest) {
    return firstValueFrom(this.http.post<{data: { newToken: string}}>(`${this.baseUrl}/login`, data));
  }

  setToken(token: string) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    this.userData.next(payload);
    this.isAuthenticated.next(true);

    const expiresAt = payload.exp * 1000;
    const timeout = expiresAt - Date.now();

    setTimeout(() => {
      this.isAuthenticated.next(false);
      this.userData.next(null);
    }, timeout);
  }
}
