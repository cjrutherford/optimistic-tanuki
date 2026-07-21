import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { CreateBusinessComponent } from './create-business.component';

describe('CreateBusinessComponent', () => {
  let component: CreateBusinessComponent;
  let fixture: ComponentFixture<CreateBusinessComponent>;
  let componentRef: ComponentRef<CreateBusinessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateBusinessComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateBusinessComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('localityId', 'city-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not emit created when the business name is empty or blank', () => {
    const emitSpy = jest.fn();
    component.created.subscribe(emitSpy);

    component.name = '   ';
    component.onSubmit();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('emits created with trimmed field values and the current locality when submitted', () => {
    const emitSpy = jest.fn();
    component.created.subscribe(emitSpy);

    component.name = '  Acme Co  ';
    component.description = '  Widgets  ';
    component.website = '  https://acme.example  ';
    component.tier.set('pro');
    component.onSubmit();

    expect(emitSpy).toHaveBeenCalledWith({
      name: 'Acme Co',
      description: 'Widgets',
      website: 'https://acme.example',
      phone: undefined,
      email: undefined,
      address: undefined,
      tier: 'pro',
      localityId: 'city-1',
    });
  });

  it('emits cancelled when cancel is triggered', () => {
    const emitSpy = jest.fn();
    component.cancelled.subscribe(emitSpy);

    component.onCancel();

    expect(emitSpy).toHaveBeenCalled();
  });
});
