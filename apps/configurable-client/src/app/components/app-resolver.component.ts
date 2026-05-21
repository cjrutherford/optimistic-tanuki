import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ConfigurationService } from '../services/configuration.service';

/**
 * AppResolverComponent handles multi-tenant app configuration loading
 * 
 * Selection methods (in order of priority):
 * 1. Route parameter: /app/:appName
 * 2. Hostname: domain-based lookup
 * 3. Query parameter: ?appName=xxx (fallback)
 * 
 * Examples:
 * - http://localhost:8090/app/demo-app - loads by name "demo-app"
 * - http://myapp.example.com - loads by domain "myapp.example.com"
 * - http://localhost:8090?appName=demo-app - loads by query param
 */
@Component({
  selector: 'app-resolver',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    @if (loading) {
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading application configuration...</p>
        @if (loadingMessage) {
          <p class="loading-message">{{ loadingMessage }}</p>
        }
      </div>
    } @else if (error) {
      <div class="error-container">
        <h1>Configuration Error</h1>
        <p class="error-message">{{ error }}</p>
        <p class="error-hint">Please check that the application configuration exists.</p>
      </div>
    } @else {
      <router-outlet></router-outlet>
    }
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      text-align: center;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-message {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.5rem;
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      text-align: center;
      color: #721c24;
      background-color: #f8d7da;
    }

    .error-message {
      font-size: 1.1rem;
      margin: 1rem 0;
    }

    .error-hint {
      font-size: 0.9rem;
      color: #856404;
      margin-top: 1rem;
    }
  `],
})
export class AppResolverComponent implements OnInit {
  loading = true;
  error: string | null = null;
  loadingMessage = '';

  constructor(
    private configService: ConfigurationService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    // Only load configuration in browser, not during SSR
    if (isPlatformBrowser(this.platformId)) {
      this.loadConfiguration();
    } else {
      // During SSR, just show loading state
      this.loading = false;
    }
  }

  private loadConfiguration(): void {
    // Priority 1: Route parameter /app/:appName
    const appNameParam = this.route.snapshot.paramMap.get('appName');
    
    if (appNameParam) {
      console.log('[AppResolver] Loading configuration by route parameter:', appNameParam);
      this.loadingMessage = `Loading app: ${appNameParam}`;
      this.loadByName(appNameParam);
      return;
    }

    // Priority 2: Hostname/domain
    const hostname = window.location.hostname;
    
    // Skip domain lookup for localhost and common development hosts
    const isLocalDevelopment = hostname === 'localhost' || 
                               hostname === '127.0.0.1' || 
                               hostname.endsWith('.local');
    
    if (!isLocalDevelopment) {
      console.log('[AppResolver] Loading configuration by domain:', hostname);
      this.loadingMessage = `Loading configuration for: ${hostname}`;
      this.loadByDomain(hostname);
      return;
    }

    // Priority 3: Query parameter ?appName=xxx (fallback for development)
    this.route.queryParams.subscribe(params => {
      const appNameQuery = params['appName'];
      
      if (appNameQuery) {
        console.log('[AppResolver] Loading configuration by query parameter:', appNameQuery);
        this.loadingMessage = `Loading app: ${appNameQuery}`;
        this.loadByName(appNameQuery);
      } else {
        // Default fallback
        console.log('[AppResolver] No app specified, using default: demo-app');
        this.loadingMessage = 'Loading default application';
        this.loadByName('demo-app');
      }
    });
  }

  private loadByName(name: string): void {
    this.configService.getConfigurationByName(name).subscribe({
      next: (config) => {
        console.log('[AppResolver] Configuration loaded successfully:', config);
        this.configService.setConfiguration(config);
        this.applyTheme(config.theme);
        this.loading = false;
      },
      error: (err) => {
        console.error('[AppResolver] Failed to load configuration by name:', name, err);
        this.error = `Failed to load application configuration for "${name}". ${err.status === 404 ? 'Configuration not found.' : 'Server error.'}`;
        this.loading = false;
      },
    });
  }

  private loadByDomain(domain: string): void {
    this.configService.getConfigurationByDomain(domain).subscribe({
      next: (config) => {
        console.log('[AppResolver] Configuration loaded successfully by domain:', config);
        this.configService.setConfiguration(config);
        this.applyTheme(config.theme);
        this.loading = false;
      },
      error: (err) => {
        console.error('[AppResolver] Failed to load configuration by domain:', domain, err);
        
        // Fallback to query parameter or default
        this.route.queryParams.subscribe(params => {
          const appNameQuery = params['appName'];
          
          if (appNameQuery) {
            console.log('[AppResolver] Falling back to query parameter:', appNameQuery);
            this.loadingMessage = `Domain not found, loading: ${appNameQuery}`;
            this.loadByName(appNameQuery);
          } else {
            console.log('[AppResolver] Falling back to default application');
            this.loadingMessage = 'Domain not found, loading default application';
            this.loadByName('demo-app');
          }
        });
      },
    });
  }

  private applyTheme(theme: any): void {
    if (!theme) return;
    
    const root = document.documentElement;
    
    if (theme.primaryColor) {
      root.style.setProperty('--primary-color', theme.primaryColor);
    }
    if (theme.secondaryColor) {
      root.style.setProperty('--secondary-color', theme.secondaryColor);
    }
    if (theme.backgroundColor) {
      root.style.setProperty('--background-color', theme.backgroundColor);
    }
    if (theme.textColor) {
      root.style.setProperty('--text-color', theme.textColor);
    }
    if (theme.fontFamily) {
      root.style.setProperty('--font-family', theme.fontFamily);
    }
    
    // Apply custom CSS if provided
    if (theme.customCss) {
      let styleElement = document.getElementById('custom-theme-css');
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'custom-theme-css';
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = theme.customCss;
    }
  }
}
