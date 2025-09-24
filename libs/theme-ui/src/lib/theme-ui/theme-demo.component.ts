import { Component } from '@angular/core';
import { PaletteSelectorComponent } from './palette-selector.component';
import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'theme-demo',
  standalone: true,
  imports: [PaletteSelectorComponent, ButtonComponent, CardComponent],
  template: `
    <div class="demo-container">
      <h1>Enhanced Theme System Demo</h1>
      
      <!-- Palette Selector -->
      <theme-palette-selector></theme-palette-selector>
      
      <!-- Component Examples -->
      <div class="examples-grid">
        <!-- Standard Component -->
        <otui-card class="demo-card">
          <div class="card-body">
            <h3>Standard Card</h3>
            <p>This card uses global theme variables automatically applied by the ThemeService.</p>
            <button class="primary">Primary Button</button>
            <button class="secondary">Secondary Button</button>
          </div>
        </otui-card>
        
        <!-- Component with Local Overrides -->
        <div class="custom-override-demo">
          <h3>Local Override Demo</h3>
          <p>This section has local color overrides that don't affect other components.</p>
          <button class="outlined">Custom Styled Button</button>
        </div>
        
        <!-- Nested Override Example -->
        <div class="nested-demo">
          <h3>Nested Override Example</h3>
          <div class="nested-child">
            <p>This child inherits the parent's local overrides.</p>
            <button class="success">Inherited Style</button>
          </div>
        </div>
      </div>
      
      <!-- Design Token Examples -->
      <div class="design-tokens-demo">
        <h2>Design Tokens in Action</h2>
        <div class="token-examples">
          <div class="spacing-example">Spacing Example</div>
          <div class="shadow-example">Shadow Example</div>
          <div class="radius-example">Border Radius Example</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: var(--spacing-xl, 32px);
      max-width: 1200px;
      margin: 0 auto;
      background-color: var(--background, #ffffff);
      color: var(--foreground, #212121);
    }
    
    .examples-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--spacing-lg, 24px);
      margin: var(--spacing-xl, 32px) 0;
    }
    
    .demo-card {
      min-height: 200px;
    }
    
    /* Local Override Example */
    .custom-override-demo {
      --local-accent: #e91e63;
      --local-complement: #4caf50;
      
      padding: var(--spacing-lg, 24px);
      border: 2px solid var(--local-complement, var(--complement));
      border-radius: var(--border-radius-lg, 8px);
      background-color: var(--local-accent, var(--accent));
      color: var(--background, #ffffff);
    }
    
    /* Nested Override Example */
    .nested-demo {
      --local-accent: #9c27b0;
      --local-complement: #ff9800;
      
      padding: var(--spacing-md, 16px);
      border: 2px dashed var(--local-accent, var(--accent));
      border-radius: var(--border-radius-lg, 8px);
    }
    
    .nested-child {
      /* Inherits parent's --local-accent and --local-complement */
      margin-top: var(--spacing-md, 16px);
      padding: var(--spacing-sm, 8px);
      background-color: var(--local-complement, var(--complement));
      color: var(--background, #ffffff);
      border-radius: var(--border-radius-md, 4px);
    }
    
    /* Design Token Examples */
    .design-tokens-demo {
      margin-top: var(--spacing-xxl, 48px);
      padding: var(--spacing-lg, 24px);
      border: 1px solid var(--complement, #c0af4b);
      border-radius: var(--border-radius-xl, 12px);
      background: linear-gradient(135deg, var(--accent, #3f51b5), var(--complement, #c0af4b));
      color: var(--background, #ffffff);
    }
    
    .token-examples {
      display: flex;
      gap: var(--spacing-md, 16px);
      flex-wrap: wrap;
      margin-top: var(--spacing-lg, 24px);
    }
    
    .spacing-example {
      padding: var(--spacing-lg, 24px);
      background-color: var(--tertiary, #7e57c2);
      border-radius: var(--border-radius-md, 4px);
      flex: 1;
      min-width: 150px;
    }
    
    .shadow-example {
      padding: var(--spacing-md, 16px);
      background-color: var(--success, #4caf50);
      border-radius: var(--border-radius-lg, 8px);
      box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
      flex: 1;
      min-width: 150px;
    }
    
    .radius-example {
      padding: var(--spacing-sm, 8px);
      background-color: var(--warning, #ff9800);
      border-radius: var(--border-radius-full, 50%);
      text-align: center;
      flex: 1;
      min-width: 150px;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    h1, h2, h3 {
      color: var(--accent, #3f51b5);
      margin-bottom: var(--spacing-md, 16px);
    }
    
    button {
      margin: var(--spacing-xs, 4px);
    }
  `],
  host: {
    // This component doesn't override anything, showing global theme usage
  }
})
export class ThemeDemoComponent extends Themeable {
  
  constructor(themeService: ThemeService) {
    super(themeService);
  }

  override applyTheme(colors: ThemeColors): void {
    // This component doesn't need any custom theme application
    // It relies entirely on CSS variables for styling
  }
}