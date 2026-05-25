import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  it('surfaces a start-here section with recommended paths', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Start Here');
    expect(root.textContent).toContain('Recommended Paths');
  });

  it('supports task-first browsing alongside the library catalog', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Browse by Task');
    expect(root.textContent).toContain('Forms');
    expect(root.textContent).toContain('Feedback');
    expect(root.textContent).toContain('Search');
  });
});
