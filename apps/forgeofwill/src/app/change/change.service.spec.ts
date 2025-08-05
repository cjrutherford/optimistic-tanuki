import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ChangeService } from './change.service';

describe('ChangeService', () => {
  let service: ChangeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ChangeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
