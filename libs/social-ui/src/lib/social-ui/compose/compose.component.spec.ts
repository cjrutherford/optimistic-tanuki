import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposeComponent } from './compose.component';
import { ComponentInjectionService } from './services/component-injection.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('ComposeComponent', () => {
  let component: ComposeComponent;
  let fixture: ComponentFixture<ComposeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposeComponent, NoopAnimationsModule],
      providers: [
        ComponentInjectionService,
        ThemeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComposeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    // The component registers components in ngAfterViewInit which can cause
    // ExpressionChangedAfterItHasBeenCheckedError in dev mode.
    // We use detectChanges with checkNoChanges disabled.
    fixture.changeDetectorRef.detectChanges();
    expect(component).toBeTruthy();
  });

  it('does not rewrite the editor when writeValue receives unchanged content', () => {
    fixture.changeDetectorRef.detectChanges();

    component.editor?.commands.setContent('<p>Alpha</p>', {
      emitUpdate: false,
    });
    component['content'] = '<p>Alpha</p>';

    const setContentSpy = jest.spyOn(component.editor!.commands, 'setContent');

    component.writeValue({
      title: 'Alpha',
      content: '<p>Alpha</p>',
      links: [],
      attachments: [],
    });

    expect(setContentSpy).not.toHaveBeenCalled();
  });

  it('does not emit ngModel changes while applying an incoming value', () => {
    fixture.changeDetectorRef.detectChanges();

    const onChange = jest.fn();
    component.registerOnChange(onChange);

    component.writeValue({
      title: 'Alpha',
      content: '<p>Alpha</p>',
      links: [],
      attachments: [],
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores injectedComponentsNew when writeValue receives new-format components', () => {
    fixture.changeDetectorRef.detectChanges();

    const components = [
      {
        instanceId: 'callout-1',
        componentType: 'callout-box',
        componentData: { title: 'Decision rhythm' },
        position: 0,
      },
    ];
    const restoreSpy = jest.spyOn(
      component as any,
      'restoreInjectedComponentData'
    );

    component.writeValue({
      title: 'Alpha',
      content: '<p>Alpha</p>',
      links: [],
      attachments: [],
      injectedComponentsNew: components,
    });

    expect(restoreSpy).toHaveBeenCalledWith(components);
  });

  it('renders the configured submit button label', () => {
    fixture.changeDetectorRef.detectChanges();

    (component as any).submitLabel = 'Save';
    fixture.changeDetectorRef.detectChanges();

    const button = fixture.nativeElement.querySelector('otui-button');
    expect(button?.textContent).toContain('Save');
  });

  it('preserves inline image dimensions in serialized editor HTML', () => {
    fixture.changeDetectorRef.detectChanges();

    component.editor?.commands.setContent(
      '<p><img src="/img.png" width="320" height="180" /></p>',
      {
        emitUpdate: false,
      }
    );

    expect(component.editor?.getHTML()).toContain('width="320"');
    expect(component.editor?.getHTML()).toContain('height="180"');
  });
});
