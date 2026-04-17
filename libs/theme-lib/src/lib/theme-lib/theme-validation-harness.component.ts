import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { ThemeService } from './theme.service';

@Component({
  selector: 'otui-theme-validation-harness',
  standalone: true,
  template: '<ng-content></ng-content>',
  host: {
    style: 'display: contents;',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeValidationHarnessComponent implements OnInit, OnChanges {
  @Input() personalityId = 'classic';
  @Input() mode: 'light' | 'dark' = 'light';
  @Input() primaryColor = '#3f51b5';

  constructor(private readonly themeService: ThemeService) {}

  ngOnInit(): void {
    void this.applyThemeContext();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    void this.applyThemeContext();
  }

  private async applyThemeContext(): Promise<void> {
    this.themeService.setPrimaryColor(this.primaryColor);
    this.themeService.setTheme(this.mode);
    await this.themeService.setPersonality(this.personalityId);
  }
}
