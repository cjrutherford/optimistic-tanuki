import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

@Component({
  imports: [RouterModule, HeaderComponent],
  selector: 'flow-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly brandConfig = inject(BrandConfigService);

  get title(): string {
    return this.brandConfig.getAppTitle();
  }
}
