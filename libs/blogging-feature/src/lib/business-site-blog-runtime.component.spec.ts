import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BusinessSiteBlogRuntimeComponent } from './business-site-blog-runtime.component';

describe('BusinessSiteBlogRuntimeComponent', () => {
  let fixture: ComponentFixture<BusinessSiteBlogRuntimeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessSiteBlogRuntimeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessSiteBlogRuntimeComponent);
  });

  it('renders only the supplied catalog posts', () => {
    fixture.componentRef.setInput('title', 'Field notes');
    fixture.componentRef.setInput('posts', [
      {
        id: 'post-north',
        name: 'North catalog update',
        description: 'A catalog-scoped post.',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Field notes');
    expect(fixture.nativeElement.textContent).toContain('North catalog update');
    expect(fixture.nativeElement.textContent).not.toContain(
      'No posts are live'
    );
  });

  it('renders an intentional empty state', () => {
    fixture.componentRef.setInput('posts', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No posts are live');
  });
});
