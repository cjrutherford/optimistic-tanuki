import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { BusinessListComponent } from './business-list.component';
import { BusinessPageDto } from './models';

describe('BusinessListComponent', () => {
  let component: BusinessListComponent;
  let fixture: ComponentFixture<BusinessListComponent>;
  let componentRef: ComponentRef<BusinessListComponent>;

  const makeBusiness = (id: string, name: string): BusinessPageDto => ({
    id,
    name,
    tier: 'basic',
    status: 'active',
    localityId: 'city-1',
    ownerId: 'user-1',
    userId: 'user-1',
    communityId: 'comm-1',
    locations: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessListComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the empty state message when there are no businesses', () => {
    const empty: HTMLElement = fixture.nativeElement.querySelector(
      '.business-list__empty'
    );

    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No businesses listed yet');
  });

  it('renders one business card per business in the input array', () => {
    componentRef.setInput('businesses', [
      makeBusiness('1', 'Business One'),
      makeBusiness('2', 'Business Two'),
      makeBusiness('3', 'Business Three'),
    ]);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('lib-business-card');

    expect(cards.length).toBe(3);
  });

  it('emits businessClicked with the corresponding business when a card is clicked', () => {
    const businesses = [makeBusiness('1', 'Business One')];
    componentRef.setInput('businesses', businesses);
    fixture.detectChanges();

    const emitSpy = jest.fn();
    component.businessClicked.subscribe(emitSpy);

    const card: HTMLElement =
      fixture.nativeElement.querySelector('lib-business-card');
    card.click();

    expect(emitSpy).toHaveBeenCalledWith(businesses[0]);
  });
});
