import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterSection } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-footer-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer-section">
      <div class="footer-content">
        <div [innerHTML]="section.content"></div>
        @if (section.links && section.links.length > 0) {
          <nav class="footer-links">
            @for (link of section.links; track link.url) {
              <a [href]="link.url">{{ link.text }}</a>
            }
          </nav>
        }
      </div>
    </footer>
  `,
  styles: [`
    .footer-section {
      padding: 3rem 2rem;
      background-color: #333;
      color: white;
    }
    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
    }
    .footer-links {
      display: flex;
      gap: 2rem;
      justify-content: center;
      margin-top: 2rem;
    }
    .footer-links a {
      color: white;
      text-decoration: none;
    }
  `],
})
export class FooterSectionComponent {
  @Input() section!: FooterSection;
}
