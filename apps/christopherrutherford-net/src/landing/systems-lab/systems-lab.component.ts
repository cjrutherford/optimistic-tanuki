import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { map } from 'rxjs';
import {
  APP_CATALOG_GROUP_LABELS,
  AppCatalogEntry,
  AppCatalogGroup,
  getRegisteredWebAppCatalog,
} from '../app-catalog.data';

@Component({
  selector: 'app-systems-lab',
  imports: [AsyncPipe],
  templateUrl: './systems-lab.component.html',
  styleUrl: './systems-lab.component.scss',
})
export class SystemsLabComponent {
  private readonly registry = inject(AppRegistryService);
  readonly catalog$ = this.registry.getAllApps().pipe(
    map((apps) => {
      const entries = getRegisteredWebAppCatalog(apps);
      const groups = [
        {
          id: 'publicApps',
          items: entries.filter((app) => app.group === 'publicApps'),
        },
        {
          id: 'internalTools',
          items: entries.filter((app) => app.group === 'internalTools'),
        },
      ] satisfies { id: AppCatalogGroup; items: AppCatalogEntry[] }[];

      return { total: entries.length, groups };
    })
  );
  readonly groupLabels = APP_CATALOG_GROUP_LABELS;
  readonly groupRoles: Record<AppCatalogGroup, string> = {
    publicApps: 'Public web app',
    internalTools: 'Internal web app',
  };
  readonly repositoryRoot =
    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/';
}
