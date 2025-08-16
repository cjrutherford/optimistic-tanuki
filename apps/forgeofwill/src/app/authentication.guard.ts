import { inject, Injectable, signal } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { AuthStateService } from "./auth-state.service";

@Injectable({
  providedIn: 'root',
})
export class AuthenticationGuard implements CanActivate {
  private router = inject(Router);
  private authState = inject(AuthStateService)
  private isAuthenticated = signal<boolean>(false);

  constructor() {
    this.authState.isAuthenticated$().subscribe(isAuth => {
      this.isAuthenticated.set(isAuth);
    });
  }

  canActivate(): boolean {
    if(this.isAuthenticated()) {
      return true;
    } else {
      this.router.navigate(['/login']);
      return false;
    }
  }
}
