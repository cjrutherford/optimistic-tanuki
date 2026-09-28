import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PortalPageComponent } from './portal-page.component';

describe('PortalPageComponent', () => {
  let component: PortalPageComponent;
  let fixture: ComponentFixture<PortalPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PortalPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the project nexus portal without demo content', () => {
    expect(
      fixture.nativeElement.querySelector('.page-title').textContent
    ).toContain('Project Nexus');
    expect(fixture.nativeElement.textContent).not.toContain('demo-project');
  });

  it('rejects an invalid project id without navigating', () => {
    component.projectId = 'not-a-uuid';
    component.openProject('milestones');
    fixture.detectChanges();

    expect(component.projectError).toContain('valid project ID');
  });

  it('accepts a UUID project id', () => {
    expect(component.isProjectId('11111111-1111-4111-8111-111111111111')).toBe(
      true
    );
    expect(component.isProjectId('demo-project')).toBe(false);
  });
});
