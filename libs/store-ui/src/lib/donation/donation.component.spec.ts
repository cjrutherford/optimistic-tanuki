import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DonationComponent } from './donation.component';
import { FormsModule } from '@angular/forms';

describe('DonationComponent', () => {
  let component: DonationComponent;
  let fixture: ComponentFixture<DonationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonationComponent, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should select preset amount', () => {
    component.selectAmount(25);
    expect(component.amount).toBe(25);
    expect(component.customAmount).toBeNull();
  });

  it('should use custom amount', () => {
    component.customAmount = 75;
    component.useCustomAmount();
    expect(component.amount).toBe(75);
  });

  it('should emit donate event with correct data', () => {
    jest.spyOn(component.donate, 'emit');
    component.amount = 50;
    component.message = 'Test donation';
    component.anonymous = true;

    component.onSubmit();

    expect(component.donate.emit).toHaveBeenCalledWith({
      amount: 50,
      message: 'Test donation',
      anonymous: true,
    });
  });

  it('should not emit donate event with invalid amount', () => {
    jest.spyOn(component.donate, 'emit');
    component.amount = 0;
    component.onSubmit();
    expect(component.donate.emit).not.toHaveBeenCalled();
  });
});
