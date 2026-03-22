import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BusinessCardComponent } from './business-card.component';
import { ComponentRef } from '@angular/core';
import { BusinessPageDto } from './models';

describe('BusinessCardComponent', () => {
  let component: BusinessCardComponent;
  let fixture: ComponentFixture<BusinessCardComponent>;
  let componentRef: ComponentRef<BusinessCardComponent>;

  const mockBusiness: BusinessPageDto = {
    id: '1',
    name: 'Test Business',
    description: 'A test business',
    tier: 'basic',
    status: 'active',
    localityId: 'city-1',
    ownerId: 'user-1',
    userId: 'user-1',
    communityId: 'comm-1',
    locations: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessCardComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('business', mockBusiness);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
