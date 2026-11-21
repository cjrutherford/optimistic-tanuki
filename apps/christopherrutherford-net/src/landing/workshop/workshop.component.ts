import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SectionHeadingComponent } from '@optimistic-tanuki/common-ui';

import { ProjectGridComponent } from '../project-grid/project-grid.component';
import { SystemsLabComponent } from '../systems-lab/systems-lab.component';

/**
 * Secondary material, collapsed by default. A link to `#systems-lab` or
 * `#platform` opens the matching <details> before scrolling to it.
 */
@Component({
  selector: 'app-workshop',
  imports: [SectionHeadingComponent, SystemsLabComponent, ProjectGridComponent],
  templateUrl: './workshop.component.html',
  styleUrl: './workshop.component.scss',
})
export class WorkshopComponent implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngAfterViewInit(): void {
    this.openForHash(true);
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.openForHash(true);
  }

  /** Opens the <details> named by the URL hash, if it is one of ours. */
  openForHash(scroll: boolean): void {
    if (!this.isBrowser) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const target = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLDetailsElement>(
        'details[id]'
      )
    ).find((details) => details.id === id);
    if (!target) return;
    target.open = true;
    if (scroll) {
      target.scrollIntoView();
    }
  }
}
