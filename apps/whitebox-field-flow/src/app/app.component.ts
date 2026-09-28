import { isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { FieldFlowApiService } from './services/field-flow-api.service';

@Component({
  imports: [RouterModule, HeaderComponent],
  selector: 'flow-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly brandConfig = inject(BrandConfigService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly apiService = inject(FieldFlowApiService);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.apiService.initializeTenant().subscribe({ error: () => undefined });
    }
  }

  get title(): string {
    return this.brandConfig.getAppTitle();
  }
}
