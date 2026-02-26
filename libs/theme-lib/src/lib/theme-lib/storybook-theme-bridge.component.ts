import {
    Component,
    Input,
    OnChanges,
    OnInit,
    SimpleChanges,
} from '@angular/core';
import { ThemeService } from './theme.service';

@Component({
    selector: 'lib-storybook-theme-bridge',
    standalone: true,
    template: '<ng-content></ng-content>',
    host: {
        style: 'display: block;',
    },
})
export class StorybookThemeBridgeComponent implements OnInit, OnChanges {
    @Input() personalityId = 'classic';
    @Input() mode: 'light' | 'dark' = 'light';
    @Input() primaryColor = '#3f51b5';

    constructor(private readonly themeService: ThemeService) { }

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
