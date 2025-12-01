import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactComponent } from './contact.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ContactService } from '../../contact.service';
import { of } from 'rxjs';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';

import { HeadingComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ReactiveFormsModule } from '@angular/forms';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';

// Remove MockLibContactFormComponent as per new instructions

describe('ContactComponent', () => {
  let component: ContactComponent;
  let fixture: ComponentFixture<ContactComponent>;
  let mockContactService: Partial<ContactService>;

  beforeEach(async () => {
    mockContactService = {
      postContact: jest.fn(() => of({}))
    };

    await TestBed.configureTestingModule({
      imports: [
        ContactComponent,
        HttpClientTestingModule,
        HeadingComponent,
        ButtonComponent,
        ReactiveFormsModule,
        ContactFormComponent,
      ],
      providers: [
        { provide: ContactService, useValue: mockContactService }
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have subjects array', () => {
    expect(component.subjects).toEqual([
      { value: 'general', label: 'General Inquiry' },
      { value: 'support', label: 'Support' },
      { value: 'feedback', label: 'Feedback' },
      { value: 'other', label: 'Other' }
    ]);
  });

  it('should call contactService.postContact when form is submitted', () => {
    const formData = { name: 'Test', email: 'test@example.com', subject: 'general', message: 'Hello' };
    component.onContactFormSubmit(formData);
    expect(mockContactService.postContact).toHaveBeenCalledWith(formData);
  });
});
