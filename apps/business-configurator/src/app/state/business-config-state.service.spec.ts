import { TestBed } from '@angular/core/testing';
import { BusinessConfigStateService } from './business-config-state.service';

describe('BusinessConfigStateService', () => {
  let service: BusinessConfigStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(BusinessConfigStateService);
  });

  it('provides the default store feature configuration', () => {
    expect(service.config().features.store).toEqual({ enabled: false });
  });
});
