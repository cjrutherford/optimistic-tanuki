import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, Renderer2, ElementRef, Input } from "@angular/core";
import { ThemeColors, ThemeService } from "@optimistic-tanuki/theme-lib";
import { filter, Subscription } from "rxjs";

@Component({
    standalone: true,
    selector: 'app-first-svg',
    templateUrl: './first-svg.component.html',
    styleUrls: ['./first-svg.component.scss'],
    imports: [CommonModule],
    providers: [ThemeService]
})
export class FirstSvgComponent implements OnInit, OnDestroy {
    @Input() theme!: string;
    @Input() accentColor!: string;
    sub!: Subscription;

    constructor(
        private readonly themeService: ThemeService,
        private renderer: Renderer2,
        private el: ElementRef
    ) {}

    ngOnInit() {
        this.sub = this.themeService.themeColors$.pipe(filter((x): x is ThemeColors => !!x)).subscribe((colors) => {
            this.accentColor = colors.accent;
        });
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }
}