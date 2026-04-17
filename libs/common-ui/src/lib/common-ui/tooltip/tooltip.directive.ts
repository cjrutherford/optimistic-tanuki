import {
  Directive,
  Input,
  ElementRef,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Directive({
  selector: '[otuiTooltip]',
  standalone: true,
})
export class TooltipDirective extends Themeable implements OnDestroy {
  @Input() otuiTooltip = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private tooltipEl: HTMLElement | null = null;

  constructor(private el: ElementRef) {
    super();
  }

  override applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      'tooltip-bg': colors.background,
      'tooltip-color': colors.foreground,
      'tooltip-border': colors.complementary,
    });
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.showTooltip();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hideTooltip();
  }

  private showTooltip(): void {
    if (this.tooltipEl || !this.otuiTooltip) return;

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'otui-tooltip';
    this.tooltipEl.textContent = this.otuiTooltip;
    document.body.appendChild(this.tooltipEl);

    this.positionTooltip();
  }

  private positionTooltip(): void {
    if (!this.tooltipEl) return;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    this.tooltipEl.style.position = 'fixed';
    this.tooltipEl.style.zIndex = '9999';

    switch (this.tooltipPosition) {
      case 'top':
        this.tooltipEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        this.tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
        break;
      case 'bottom':
        this.tooltipEl.style.top = `${rect.bottom + 8}px`;
        this.tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
        break;
      case 'left':
        this.tooltipEl.style.top = `${rect.top + rect.height / 2}px`;
        this.tooltipEl.style.right = `${window.innerWidth - rect.left + 8}px`;
        break;
      case 'right':
        this.tooltipEl.style.top = `${rect.top + rect.height / 2}px`;
        this.tooltipEl.style.left = `${rect.right + 8}px`;
        break;
    }

    this.tooltipEl.style.transform = 'translateX(-50%)';
  }

  private hideTooltip(): void {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }

  override ngOnDestroy(): void {
    this.hideTooltip();
  }
}
