import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, switchMap } from 'rxjs';
import { GeneratedLink, NavigationPosition } from '../navigation.types';
import { NavigationService } from '../navigation.service';

@Component({
  selector: 'ot-registry-navigation-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="registry-nav-menu" [ngClass]="'registry-nav-menu--' + position">
      @for (link of links; track link.url) {
      <a [href]="link.url" class="registry-nav-menu__link">
        @if (link.meta.iconName) {
        <span aria-hidden="true">{{ link.meta.iconName }}</span>
        }
        <span>{{ link.meta.label }}</span>
      </a>
      }
    </nav>
  `,
})
export class NavigationMenuComponent implements OnChanges {
  @Input({ required: true }) appId!: string;
  @Input() position: NavigationPosition = 'primary';
  @Input() isAuthenticated = false;

  links: GeneratedLink[] = [];

  private readonly inputChange$ = new BehaviorSubject<void>(undefined);
  private readonly destroyRef = inject(DestroyRef);

  constructor(private readonly navigation: NavigationService) {
    this.inputChange$
      .pipe(
        switchMap(() =>
          this.navigation.getFilteredLinks({
            currentAppId: this.appId,
            currentPath: '/',
            isAuthenticated: this.isAuthenticated,
          })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((links) => {
        this.links = links.filter(
          (link) =>
            this.position === 'primary' ||
            link.meta.position === this.position
        );
      });
  }

  ngOnChanges(): void {
    this.inputChange$.next();
  }
}
