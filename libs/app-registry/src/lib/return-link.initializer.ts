import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideAppInitializer, inject } from '@angular/core';
import { NavigationService } from './navigation.service';

export function initializeReturnLink(navigation: NavigationService): () => void {
  return () => {
    navigation.captureReturnTo();
  };
}

export function provideReturnLinkHandling(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => initializeReturnLink(inject(NavigationService))()),
  ]);
}
