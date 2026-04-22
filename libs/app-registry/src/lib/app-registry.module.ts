import { NgModule } from '@angular/core';
import { NavigationLinkComponent } from './components/navigation-link.component';
import { NavigationMenuComponent } from './components/navigation-menu.component';

@NgModule({
  imports: [NavigationLinkComponent, NavigationMenuComponent],
  exports: [NavigationLinkComponent, NavigationMenuComponent],
})
export class AppRegistryModule {}
