import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, Renderer2, ElementRef, Input } from "@angular/core";
import { ThemeColors, ThemeService } from "@optimistic-tanuki/theme-ui";
import { filter, Subscription } from "rxjs";

/**
 * Component for displaying an SVG with theme-dependent styling.
 */
@Component({
    standalone: true,
    selector: 'app-first-svg',
    templateUrl: './first-svg.component.html',
    styleUrls: ['./first-svg.component.scss'],
    imports: [CommonModule],
    providers: [ThemeService]
})
export class FirstSvgComponent implements OnInit, OnDestroy {
    /**
     * Input property for the theme name.
     */
    @Input() theme!: string;
    /**
     * Input property for the accent color.
     */
    @Input() accentColor!: string;
    /**
     * Subscription for theme changes.
     */
    sub!: Subscription;

    /**
     * Creates an instance of FirstSvgComponent.
     * @param themeService The service for managing themes.
     * @param renderer The Angular Renderer2.
     * @param el The ElementRef of the component.
     */
    constructor(
        private readonly themeService: ThemeService,
        private renderer: Renderer2,
        private el: ElementRef
    ) {}

    /**
     * Initializes the component and subscribes to theme changes.
     */
    ngOnInit() {
        this.sub = this.themeService.themeColors$.pipe(filter((x): x is ThemeColors => !!x)).subscribe((colors) => {
            this.accentColor = colors.accent;
        });
    }

    /**
     * Cleans up subscriptions when the component is destroyed.
     */
    ngOnDestroy() {
        this.sub.unsubscribe();
    }
}