import { TestBed } from '@angular/core/testing';

import { ChangeService } from './change.service';

describe('ChangeService', () => {
  let service: ChangeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChangeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
