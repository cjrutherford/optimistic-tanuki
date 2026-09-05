import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MakeOfferModalComponent } from './make-offer-modal.component';
import { PaymentService } from '../../services/payment.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

describe('MakeOfferModalComponent', () => {
  let fixture: ComponentFixture<MakeOfferModalComponent>;
  let component: MakeOfferModalComponent;
  const paymentService = { createOffer: jest.fn() };
  const messageService = { addMessage: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [MakeOfferModalComponent],
      providers: [
        { provide: PaymentService, useValue: paymentService },
        { provide: MessageService, useValue: messageService },
      ],
    });
    fixture = TestBed.createComponent(MakeOfferModalComponent);
    component = fixture.componentInstance;
    component.classifiedId = 'classified-1';
    component.sellerId = 'seller-1';
    component.listingTitle = 'Vintage Bike';
    component.askingPrice = 100;
    fixture.detectChanges();
  });

  it('computes the platform fee and seller payout', () => {
    component.offerAmount = 100;
    expect(component.getTotalFee()).toBeCloseTo(10.5, 2);
    expect(component.getSellerReceives()).toBeCloseTo(89.5, 2);
  });

  it('returns 0 fee and payout when there is no offer amount', () => {
    component.offerAmount = null;
    expect(component.getTotalFee()).toBe(0);
    expect(component.getSellerReceives()).toBe(0);
  });

  it('emits closed when the modal is closed', () => {
    const closeSpy = jest.spyOn(component.closed, 'emit');
    component.onClose();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('rejects submission without a valid offer amount', async () => {
    component.offerAmount = 0;
    await component.onSubmit();
    expect(component.error()).toBe('Please enter a valid offer amount');
    expect(paymentService.createOffer).not.toHaveBeenCalled();
  });

  it('submits an offer, notifies success, and closes the modal', async () => {
    const offer = { id: 'offer-1' };
    paymentService.createOffer.mockResolvedValue(offer);
    const submittedSpy = jest.spyOn(component.offerSubmitted, 'emit');
    const closedSpy = jest.spyOn(component.closed, 'emit');

    component.offerAmount = 80;
    component.message = 'Would you take 80?';
    await component.onSubmit();

    expect(paymentService.createOffer).toHaveBeenCalledWith(
      'classified-1',
      'seller-1',
      80,
      'Would you take 80?'
    );
    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Your offer has been submitted!',
      type: 'success',
    });
    expect(submittedSpy).toHaveBeenCalledWith(offer);
    expect(closedSpy).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('submits without a message when none was entered', async () => {
    paymentService.createOffer.mockResolvedValue({ id: 'offer-2' });
    component.offerAmount = 50;
    component.message = '';
    await component.onSubmit();

    expect(paymentService.createOffer).toHaveBeenCalledWith(
      'classified-1',
      'seller-1',
      50,
      undefined
    );
  });

  it('surfaces an error when offer submission fails', async () => {
    paymentService.createOffer.mockRejectedValue(new Error('network error'));
    component.offerAmount = 60;

    await component.onSubmit();

    expect(component.error()).toBe('Failed to submit offer. Please try again.');
    expect(component.loading()).toBe(false);
  });
});
