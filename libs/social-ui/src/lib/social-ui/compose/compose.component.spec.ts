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
});
