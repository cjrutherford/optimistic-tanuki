import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    __env__: {
      GIT_SHA?: string;
      STARTUP_TIME?: string;
      NODE_ENV?: string;
    };
  }
}

@Component({
  selector: 'otui-dev-info',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (show) {
    <div class="dev-info">
      <span class="sha">{{ sha || 'unknown' }}</span>
      <span class="divider">|</span>
      <span class="time">{{ formattedTime }}</span>
    </div>
    }
  `,
  styles: [
    `
      .dev-info {
        position: fixed;
        bottom: 8px;
        left: 8px;
        background: rgba(0, 0, 0, 0.75);
        color: #00ff00;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .divider {
        color: #666;
      }
      .sha {
        font-weight: bold;
      }
      .time {
        color: #aaa;
      }
    `,
  ],
})
export class DevInfoComponent implements OnInit {
  show = false;
  sha = '';
  formattedTime = '';

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const env = window.__env__;
      const isDev = env?.NODE_ENV === 'development';

      if (isDev && (env?.GIT_SHA || env?.STARTUP_TIME)) {
        this.show = true;
        this.sha = env.GIT_SHA?.substring(0, 7) || 'unknown';

        if (env.STARTUP_TIME) {
          try {
            const date = new Date(env.STARTUP_TIME);
            this.formattedTime = date.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
          } catch {
            this.formattedTime = env.STARTUP_TIME;
          }
        }
      }
    }
  }
}
