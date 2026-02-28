import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

export interface Tab {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

@Component({
  selector: 'otui-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[class.tabs-vertical]': 'vertical',
  },
})
export class TabsComponent extends Themeable {
  @Input() tabs: Tab[] = [];
  @Input() activeTab = '';
  @Input() vertical = false;
  @Output() tabChange = new EventEmitter<string>();

  override applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariables({
      'tabs-active-color': colors.accent,
      'tabs-inactive-color': colors.foreground,
      'tabs-border-color': colors.complementary,
    });
  }

  selectTab(tab: Tab): void {
    if (tab.disabled) return;
    this.activeTab = tab.id;
    this.tabChange.emit(tab.id);
  }
}
