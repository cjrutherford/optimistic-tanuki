import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Change } from '@optimistic-tanuki/ui-models';
import { ChangeFormComponent } from './change-form.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';

describe('ChangeFormComponent', () => {
  let component: ChangeFormComponent;
  let fixture: ComponentFixture<ChangeFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangeFormComponent, ReactiveFormsModule, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the form', () => {
    expect(component.changeForm).toBeDefined();
    expect(component.changeForm.get('changeType')).toBeDefined();
    expect(component.changeForm.get('changeDescription')).toBeDefined();
    expect(component.changeForm.get('changeStatus')).toBeDefined();
    expect(component.changeForm.get('changeDate')).toBeDefined();
    expect(component.changeForm.get('requestor')).toBeDefined();
  });

  it('should emit form value on submit', () => {
    jest.spyOn(component.submitted, 'emit');
    component.changeForm.setValue({
      changeType: 'ADDITION',
      changeDescription: 'New feature',
      changeStatus: 'PENDING',
      changeDate: '2025-01-01',
      requestor: 'test-user',
    });
    component.onSubmit();
        expect(component.submitted.emit).toHaveBeenCalledWith({
      changeType: 'ADDITION',
      changeDescription: 'New feature',
      changeStatus: 'PENDING',
      changeDate: '2025-01-01',
      requestor: 'test-user',
    });
  });

  it('should patch form when change input is provided', () => {
    const change: Change = {
      id: '1',
      projectId: '1',
      changeDescription: 'Update feature',
      changeType: 'MODIFICATION',
      changeStatus: 'COMPLETE',
      changeDate: new Date('2025-01-02'),
      requestor: 'test-user-2',
      resolution: 'APPROVED',
    };
    component.change = change;
    component.ngOnInit();
    expect(component.changeForm.value).toEqual({
      changeType: 'MODIFICATION',
      changeDescription: 'Update feature',
      changeStatus: 'COMPLETE',
      changeDate: new Date('2025-01-02'),
      requestor: 'test-user-2',
    });
    expect(component.isEditing()).toBe(true);
  });

  it('should not patch form when change input is null', () => {
    component.change = null;
    component.ngOnInit();
    expect(component.changeForm.value).toEqual({
      changeType: 'ADDITION',
      changeDescription: '',
      changeStatus: 'PENDING',
      changeDate: '',
      requestor: '',
    });
    expect(component.isEditing()).toBe(false);
  });
});
