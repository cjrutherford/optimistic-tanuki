import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { ModalComponent } from './modal.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ModalComponent', () => {
  let component: ModalComponent;
  let fixture: ComponentFixture<ModalComponent>;
  let themeService: ThemeService;

  // jsdom does not implement window.scrollTo; the scroll-lock teardown calls it.
  beforeAll(() => {
    jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalComponent],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply dark theme colors when theme is dark', () => {
    const mockColors = {
      background: '#000',
      foreground: '#fff',
      accent: '#111',
      complementary: '#222',
      complementaryGradients: {
        dark: 'dark-gradient',
        light: 'light-gradient',
      },
      accentGradients: {
        dark: 'dark-accent-gradient',
        light: 'light-accent-gradient',
      },
      complementaryShades: [
        [null, '#666'],
        [null, '#777'],
        [null, '#888'],
        [null, '#999'],
        [null, '#aaa'],
        [null, '#bbb'],
        [null, '#ccc'],
      ],
    } as any;

    component.theme = 'dark';
    component.applyTheme(mockColors);

    // Modal applyTheme sets background to colors.background directly
    expect(component.background).toBe(mockColors.background);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.borderColor).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(
      mockColors.complementaryGradients.light
    );
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.complement).toBe(mockColors.complementary);
  });

  it('should apply light theme colors when theme is light', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
      complementaryGradients: {
        dark: 'dark-gradient',
        light: 'light-gradient',
      },
      accentGradients: {
        dark: 'dark-accent-gradient',
        light: 'light-accent-gradient',
      },
      complementaryShades: [
        [null, '#666'],
        [null, '#777'],
        [null, '#888'],
        [null, '#999'],
        [null, '#aaa'],
        [null, '#bbb'],
        [null, '#ccc'],
      ],
    } as any;

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.background).toBe(mockColors.background);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.borderColor).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(
      mockColors.complementaryGradients.light
    );
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.complement).toBe(mockColors.complementary);
  });

  it('should emit closeModal event when emitting', () => {
    jest.spyOn(component.closeModal, 'emit');
    component.closeModal.emit();
    expect(component.closeModal.emit).toHaveBeenCalled();
  });

  it('should show modal when show() is called', () => {
    component.visible = false;
    component.show();
    expect(component.visible).toBe(true);
  });

  it('should hide modal when hide() is called', () => {
    component.visible = true;
    component.hide();
    expect(component.visible).toBe(false);
  });

  it('should support different modal sizes', () => {
    component.size = 'sm';
    fixture.detectChanges();
    expect(component.size).toBe('sm');

    component.size = 'lg';
    fixture.detectChanges();
    expect(component.size).toBe('lg');
  });

  it('should support different modal positions', () => {
    component.position = 'center';
    fixture.detectChanges();
    expect(component.position).toBe('center');

    component.position = 'sidebar-left';
    fixture.detectChanges();
    expect(component.position).toBe('sidebar-left');
  });

  it('ignores the first [visible] change (handled by ngAfterViewInit)', () => {
    const onOpen = jest.spyOn(
      component as unknown as { onModalOpen: () => void },
      'onModalOpen'
    );

    component.visible = true;
    component.ngOnChanges({
      visible: new SimpleChange(undefined, true, true),
    });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens, traps focus, and locks scroll when shown via the [visible] input', fakeAsync(() => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    component.visible = true;
    fixture.detectChanges();
    component.ngOnChanges({
      visible: new SimpleChange(false, true, false),
    });
    tick(0); // run the deferred onModalOpen
    tick(100); // run the deferred focus move

    expect(document.body.style.position).toBe('fixed');
    expect(document.activeElement).not.toBe(trigger);

    document.body.removeChild(trigger);

    // Restore body styles to avoid leaking scroll-lock into sibling tests.
    component.visible = false;
    component.ngOnChanges({
      visible: new SimpleChange(true, false, false),
    });
  }));

  it('restores focus and unlocks scroll when hidden via the [visible] input', fakeAsync(() => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    component.visible = true;
    fixture.detectChanges();
    component.ngOnChanges({
      visible: new SimpleChange(false, true, false),
    });
    tick(0);
    tick(100);

    component.visible = false;
    component.ngOnChanges({
      visible: new SimpleChange(true, false, false),
    });

    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.position).toBe('');

    document.body.removeChild(trigger);
  }));
});
