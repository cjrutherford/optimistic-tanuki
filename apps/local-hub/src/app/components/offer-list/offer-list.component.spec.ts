import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { OfferListComponent } from './offer-list.component';
import { Offer } from '../../services/payment.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    classifiedId: 'classified-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    offeredAmount: 100,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-08T00:00:00.000Z',
    ...overrides,
  } as Offer;
}

describe('OfferListComponent', () => {
  let fixture: ComponentFixture<OfferListComponent>;
  let component: OfferListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OfferListComponent],
      providers: [
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
      ],
    });
    fixture = TestBed.createComponent(OfferListComponent);
    component = fixture.componentInstance;
  });

  it('returns the status text unchanged', () => {
    expect(component.formatStatus('pending')).toBe('pending');
  });

  it('only allows management responses on pending/countered offers when canManage', () => {
    component.canManage = true;
    expect(component.canRespond(makeOffer({ status: 'pending' }))).toBe(true);
    expect(component.canRespond(makeOffer({ status: 'countered' }))).toBe(true);
    expect(component.canRespond(makeOffer({ status: 'accepted' }))).toBe(false);
  });

  it('never allows a response when the viewer cannot manage the listing', () => {
    component.canManage = false;
    expect(component.canRespond(makeOffer({ status: 'pending' }))).toBe(false);
  });

  it('emits acceptOffer only when the confirm dialog is accepted', () => {
    const acceptSpy = jest.spyOn(component.acceptOffer, 'emit');
    const offer = makeOffer();

    window.confirm = jest.fn().mockReturnValue(false);
    component.onAccept(offer);
    expect(acceptSpy).not.toHaveBeenCalled();

    window.confirm = jest.fn().mockReturnValue(true);
    component.onAccept(offer);
    expect(acceptSpy).toHaveBeenCalledWith(offer);
  });

  it('emits rejectOffer only when the confirm dialog is accepted', () => {
    const rejectSpy = jest.spyOn(component.rejectOffer, 'emit');
    const offer = makeOffer();

    window.confirm = jest.fn().mockReturnValue(false);
    component.onReject(offer);
    expect(rejectSpy).not.toHaveBeenCalled();

    window.confirm = jest.fn().mockReturnValue(true);
    component.onReject(offer);
    expect(rejectSpy).toHaveBeenCalledWith(offer);
  });

  it('opens the counter modal pre-filled from an existing counter offer', () => {
    const offer = makeOffer({ counterOfferAmount: 75 });
    component.onCounter(offer);

    expect(component.showCounterModal()).toBe(true);
    expect(component.counterAmount).toBe(75);
    expect(component.selectedOffer).toBe(offer);
  });

  it('falls back to the offered amount when there is no prior counter', () => {
    const offer = makeOffer({ offeredAmount: 120 });
    component.onCounter(offer);
    expect(component.counterAmount).toBe(120);
  });

  it('closes the counter modal and clears selection', () => {
    component.onCounter(makeOffer());
    component.closeCounterModal();

    expect(component.showCounterModal()).toBe(false);
    expect(component.selectedOffer).toBeNull();
  });

  it('does nothing when submitting a counter with no selection', async () => {
    const counterSpy = jest.spyOn(component.counterOffer, 'emit');
    await component.submitCounter();
    expect(counterSpy).not.toHaveBeenCalled();
  });

  it('emits counterOffer with the entered amount and message, then closes', async () => {
    const counterSpy = jest.spyOn(component.counterOffer, 'emit');
    const offer = makeOffer();
    component.onCounter(offer);
    component.counterAmount = 90;
    component.counterMessage = 'Best I can do';

    await component.submitCounter();

    expect(counterSpy).toHaveBeenCalledWith({
      offer,
      amount: 90,
      message: 'Best I can do',
    });
    expect(component.showCounterModal()).toBe(false);
  });

  it('renders offers passed in via the offers signal input', () => {
    component.offers = signal([makeOffer({ offeredAmount: 55 })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('55');
  });
});
