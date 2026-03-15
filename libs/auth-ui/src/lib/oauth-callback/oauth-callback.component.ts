import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'lib-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oauth-callback-container">
      <div *ngIf="!error" class="loading">
        <h2>Completing authentication...</h2>
        <p>Please wait while we process your login.</p>
        <div class="spinner"></div>
      </div>
      <div *ngIf="error" class="error">
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <p class="subtext">You can close this window and try again.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .oauth-callback-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          Oxygen, Ubuntu, sans-serif;
      }

      .loading h2,
      .error h2 {
        margin: 0 0 10px;
        font-size: 24px;
      }

      .loading p,
      .error p {
        margin: 0 0 20px;
        color: #666;
      }

      .error h2 {
        color: #d32f2f;
      }

      .subtext {
        font-size: 14px;
        color: #999;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class OAuthCallbackComponent implements OnInit {
  error: string | null = null;
  private platformId = inject(PLATFORM_ID);

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // Parse query parameters from URL
    this.route.queryParams.subscribe((params) => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      const errorDescription = params['error_description'];

      if (error) {
        this.error = errorDescription || error;
        this.sendMessageToParent({
          type: 'oauth-callback',
          payload: {
            success: false,
            error: error,
            errorDescription: errorDescription,
          },
        });
        return;
      }

      if (!code) {
        this.error = 'No authorization code received';
        this.sendMessageToParent({
          type: 'oauth-callback',
          payload: {
            success: false,
            error: 'No authorization code received',
          },
        });
        return;
      }

      // Send successful result to parent window
      this.sendMessageToParent({
        type: 'oauth-callback',
        payload: {
          success: true,
          code: code,
          state: state,
        },
      });
    });
  }

  private sendMessageToParent(message: any): void {
    if (window.opener) {
      window.opener.postMessage(message, window.location.origin);
      // Close the popup after a short delay to allow the message to be processed
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      this.error = 'Unable to communicate with parent window';
    }
  }
}
