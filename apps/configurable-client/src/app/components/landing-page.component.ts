import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigurationService } from '../services/configuration.service';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { ConfigurableLandingPageComponent } from '@optimistic-tanuki/configurable-client-ui';

@Component({
  selector: 'app-configurable-client-landing-page-shell',
  standalone: true,
  imports: [CommonModule, ConfigurableLandingPageComponent],
  template: `
    <app-landing-page
      [config]="resolvedConfig"
      [embeddedPreview]="embeddedPreview"
    ></app-landing-page>
  `,
})
export class LandingPageComponent implements OnInit, OnChanges {
  @Input() config: AppConfiguration | null = null;
  @Input() embeddedPreview = false;

  resolvedConfig: AppConfiguration | null = null;

  constructor(private readonly configService: ConfigurationService) {}

  ngOnInit(): void {
    this.syncConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.syncConfig();
    }
  }

  private syncConfig(): void {
    this.resolvedConfig =
      this.config ?? this.configService.getCurrentConfiguration();
  }
}
