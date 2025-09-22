import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-callout-box',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <otui-card class="callout-box" [ngClass]="'callout-' + type">
      <div class="callout-content">
        <div class="callout-title" *ngIf="title">{{ title }}</div>
        <div class="callout-text">{{ content }}</div>
      </div>
    </otui-card>
  `,
  styles: [`
    .callout-box {
      margin: 1rem 0;
      border-left: 4px solid;
    }
    
    .callout-info {
      border-left-color: #2196F3;
      background-color: #E3F2FD;
    }
    
    .callout-warning {
      border-left-color: #FF9800;
      background-color: #FFF3E0;
    }
    
    .callout-success {
      border-left-color: #4CAF50;
      background-color: #E8F5E8;
    }
    
    .callout-error {
      border-left-color: #F44336;
      background-color: #FFEBEE;
    }
    
    .callout-content {
      padding: 1rem;
    }
    
    .callout-title {
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    
    .callout-text {
      line-height: 1.5;
    }
  `]
})
export class CalloutBoxComponent {
  @Input() type: 'info' | 'warning' | 'success' | 'error' = 'info';
  @Input() title = '';
  @Input() content = 'This is a callout box component.';
}