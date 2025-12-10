import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposeComponent } from './compose.component';
import { ComponentInjectionService } from './services/component-injection.service';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ComposeComponent', () => {
  let component: ComposeComponent;
  let fixture: ComponentFixture<ComposeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposeComponent, MatDialogModule, NoopAnimationsModule],
      providers: [ComponentInjectionService, ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ComposeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
