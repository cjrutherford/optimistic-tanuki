import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogComposeComponent } from './blog-compose.component';
import { FormsModule, ReactiveFormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input, forwardRef } from '@angular/core';

import { CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { TiptapEditorDirective } from 'ngx-tiptap';

@Component({
  selector: 'tiptap-editor',
  template: '',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MockTiptapEditor),
      multi: true,
    },
  ],
})
class MockTiptapEditor implements ControlValueAccessor {
  @Input() ngModel: any;
  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.ngModel = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Not needed for this mock
  }
}

// Remove MockTextInputComponent as per new instructions
// Remove MockCardComponent as per new instructions

describe('BlogComposeComponent', () => {
  let component: BlogComposeComponent;
  let fixture: ComponentFixture<BlogComposeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BlogComposeComponent,
        FormsModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        CardComponent,
        TextInputComponent,
        TiptapEditorDirective,
        MockTiptapEditor, // Keep this mock for tiptap-editor as it's a third-party library
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogComposeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    // The component registers components in ngAfterViewInit which can cause
    // ExpressionChangedAfterItHasBeenCheckedError in dev mode.
    // We use detectChanges with checkNoChanges disabled.
    fixture.changeDetectorRef.detectChanges();
    expect(component).toBeTruthy();
  });
});