import { Component, ContentChildren, QueryList, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabComponent } from './tab/tab.component';

@Component({
  selector: 'otui-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
})
export class TabsComponent implements AfterContentInit {
  @ContentChildren(TabComponent) tabs!: QueryList<TabComponent>;
  activeTabIndex = 0;

  ngAfterContentInit() {
    if (this.tabs.length) {
      this.setActiveTab(0);
    }
  }

  setActiveTab(index: number) {
    this.activeTabIndex = index;
  }
}
