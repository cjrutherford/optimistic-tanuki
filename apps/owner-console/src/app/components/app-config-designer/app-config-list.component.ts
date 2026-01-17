import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * App Configuration List Component (Phase 2 - Stub)
 * 
 * This component will list all created app configurations and allow:
 * - Viewing all configurations
 * - Creating new configurations
 * - Editing existing configurations
 * - Deleting configurations
 * - Activating/deactivating configurations
 * 
 * TODO: Implement full CRUD functionality
 */
@Component({
  selector: 'app-config-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-config-list">
      <h1>Application Configurations</h1>
      <p class="stub-notice">
        <strong>Phase 2: Coming Soon</strong><br>
        This will display a list of all configured applications with CRUD operations.
      </p>
      
      <div class="planned-features">
        <h2>Planned Features:</h2>
        <ul>
          <li>📋 List all app configurations</li>
          <li>➕ Create new configuration</li>
          <li>✏️ Edit existing configuration</li>
          <li>🗑️ Delete configuration</li>
          <li>🔄 Activate/deactivate configuration</li>
          <li>👁️ Preview configuration</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .app-config-list {
      padding: 2rem;
    }
    
    .stub-notice {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }
    
    .planned-features {
      margin-top: 2rem;
    }
    
    .planned-features h2 {
      color: #333;
      margin-bottom: 1rem;
    }
    
    .planned-features ul {
      list-style: none;
      padding: 0;
    }
    
    .planned-features li {
      padding: 0.5rem 0;
      font-size: 1.1rem;
    }
  `]
})
export class AppConfigListComponent {
  // Stub component - full implementation in Phase 2
}
