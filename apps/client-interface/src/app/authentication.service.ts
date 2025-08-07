import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginRequest, RegisterRequest, UserDto } from '@optimistic-tanuki/ui-models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
/**
 * Service for handling user authentication.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  /**
   * BehaviorSubject to track authentication status.
   */
  isAuthenticated: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  /**
   * BehaviorSubject to store user data.
   */
  userData: BehaviorSubject<UserDto | null> = new BehaviorSubject<UserDto | null>(null);

  /**
   * Creates an instance of AuthenticationService.
   * @param http The HttpClient instance.
   */
  constructor(private readonly http: HttpClient) { }

  /**
   * Returns an observable of the authentication status.
   * @returns An Observable of boolean indicating authentication status.
   */
  isAuthenticated$() {
    return this.isAuthenticated.asObservable();
  }

  /**
   * Registers a new user.
   * @param data The registration request data.
   * @returns An Observable of the HTTP response.
   */
  register(data: RegisterRequest) {
    return this.http.post('/api/authentication/register', data);
  } 

  /**
   * Logs in a user.
   * @param data The login request data.
   * @returns A Promise that resolves to the new token.
   */
  async login(data: LoginRequest) {
    return firstValueFrom(this.http.post<{data: { newToken: string}}>('/api/authentication/login', data));
  }

  /**
   * Sets the authentication token and updates authentication status.
   * @param token The authentication token.
   */
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
