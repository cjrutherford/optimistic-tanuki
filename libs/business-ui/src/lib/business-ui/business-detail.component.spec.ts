import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BusinessDetailComponent } from './business-detail.component';
import { ComponentRef } from '@angular/core';
import { BusinessPageDto } from './models';

describe('BusinessDetailComponent', () => {
  let component: BusinessDetailComponent;
  let fixture: ComponentFixture<BusinessDetailComponent>;
  let componentRef: ComponentRef<BusinessDetailComponent>;

  const mockBusiness: BusinessPageDto = {
    id: '1',
    name: 'Test Business',
    description: 'A test business',
    tier: 'pro',
    status: 'active',
    localityId: 'city-1',
    ownerId: 'user-1',
    userId: 'user-1',
    communityId: 'comm-1',
    locations: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    website: 'https://example.com',
    phone: '555-0100',
    email: 'info@test.com',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessDetailComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('business', mockBusiness);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the business name and hides the edit button when not the owner', () => {
    const title: HTMLElement = fixture.nativeElement.querySelector(
      '.business-detail__title h1'
    );
    const editButton: HTMLElement =
      fixture.nativeElement.querySelector('.btn-outline');

    expect(title.textContent).toContain('Test Business');
    expect(editButton).toBeNull();
  });

  it('emits editClicked when the owner clicks the edit button', () => {
    componentRef.setInput('isOwner', true);
    fixture.detectChanges();

    const emitSpy = jest.fn();
    component.editClicked.subscribe(emitSpy);

    const editButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.btn-outline');
    editButton.click();

    expect(emitSpy).toHaveBeenCalled();
  });
});
