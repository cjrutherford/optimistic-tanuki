import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AppBarComponent, NavSidebarComponent, NavItem } from '@optimistic-tanuki/navigation-ui';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppBarComponent,
    NavSidebarComponent,
  ],
  template: `
    <div class="dashboard-container">
      <otui-app-bar
        appTitle="Owner Console"
        [showThemeToggle]="true"
        [useTile]="false"
        (menuToggle)="toggleSidebar()"
        [logoSrc]="'/temptest-in-a-teacup.png'"
        logoAlt="Owner Console Logo"
      ></otui-app-bar>

      <otui-nav-sidebar
        [isOpen]="sidebarOpen"
        [navItems]="navItems"
        heading="Management"
        (close)="closeSidebar()"
      ></otui-nav-sidebar>

      <div class="content" [class.sidebar-open]="sidebarOpen">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .content {
        flex: 1;
        padding: 2rem;
        transition: margin-left 0.3s ease;
      }

      .content.sidebar-open {
        margin-left: 250px;
      }

      @media (max-width: 768px) {
        .content.sidebar-open {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  sidebarOpen = false;
  navItems: NavItem[] = [];

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.navItems = [
      {
        label: 'Users',
        action: () => this.router.navigate(['/dashboard/users']),
        variant: 'text',
        isActive: this.router.url.includes('/users'),
      },
      {
        label: 'Roles',
        action: () => this.router.navigate(['/dashboard/roles']),
        variant: 'text',
        isActive: this.router.url.includes('/roles'),
      },
      {
        label: 'Permissions',
        action: () => this.router.navigate(['/dashboard/permissions']),
        variant: 'text',
        isActive: this.router.url.includes('/permissions'),
      },
      {
        label: 'App Scopes',
        action: () => this.router.navigate(['/dashboard/app-scopes']),
        variant: 'text',
        isActive: this.router.url.includes('/app-scopes'),
      },
      {
        label: 'Logout',
        action: () => this.logout(),
        variant: 'danger',
      },
    ];

    // Navigate to users by default
    if (this.router.url === '/dashboard') {
      this.router.navigate(['/dashboard/users']);
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.authService.logout();
  }
}
