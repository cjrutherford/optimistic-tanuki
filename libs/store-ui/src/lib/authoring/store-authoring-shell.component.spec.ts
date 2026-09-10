import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StoreAuthoringDataService } from '@optimistic-tanuki/store-data-access';
import { StoreAuthoringShellComponent } from './store-authoring-shell.component';

describe('StoreAuthoringShellComponent', () => {
  let fixture: ComponentFixture<StoreAuthoringShellComponent>;
  let data: jest.Mocked<
    Pick<
      StoreAuthoringDataService,
      'listCatalogs' | 'listProducts' | 'createCatalog' | 'createProduct'
    >
  >;

  beforeEach(async () => {
    data = {
      listCatalogs: jest
        .fn()
        .mockReturnValue(
          of([{ id: 'catalog-1', name: 'Guides', description: null }])
        ),
      listProducts: jest
        .fn()
        .mockReturnValue(
          of([
            {
              id: 'product-1',
              name: 'Guide',
              priceCents: 1200,
              type: 'digital',
            },
          ])
        ),
      createCatalog: jest
        .fn()
        .mockReturnValue(
          of({ id: 'catalog-2', name: 'Courses', description: null })
        ),
      createProduct: jest
        .fn()
        .mockReturnValue(
          of({
            id: 'product-2',
            name: 'Course',
            priceCents: 2400,
            type: 'digital',
          })
        ),
    };

    await TestBed.configureTestingModule({
      imports: [StoreAuthoringShellComponent],
      providers: [{ provide: StoreAuthoringDataService, useValue: data }],
    }).compileComponents();
    fixture = TestBed.createComponent(StoreAuthoringShellComponent);
  });

  it('loads workspace catalogs and selected-catalog products', () => {
    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.detectChanges();

    expect(data.listCatalogs).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      workspaceSlug: 'north-star',
    });
    expect(data.listProducts).toHaveBeenCalledWith(
      { workspaceId: 'workspace-1', workspaceSlug: 'north-star' },
      'catalog-1'
    );
    expect(fixture.nativeElement.textContent).toContain('Guides');
    expect(fixture.nativeElement.textContent).toContain('Guide');
  });

  it('offers catalog and product creation actions within the workspace', () => {
    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.detectChanges();

    const catalogName = fixture.nativeElement.querySelector(
      '[data-catalog-name]'
    ) as HTMLInputElement;
    catalogName.value = 'Courses';
    catalogName.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('[data-create-catalog]').click();

    expect(data.createCatalog).toHaveBeenCalledWith(
      { workspaceId: 'workspace-1', workspaceSlug: 'north-star' },
      {
        name: 'Courses',
      }
    );
  });

  it('offers catalog creation when the workspace has no catalog yet', () => {
    data.listCatalogs.mockReturnValue(of([]));
    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.detectChanges();

    const catalogName = fixture.nativeElement.querySelector(
      '[data-catalog-name]'
    ) as HTMLInputElement;

    expect(catalogName).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-create-catalog]')
    ).toBeTruthy();
  });

  it('does not load or create when workspaceId is blank', () => {
    fixture.componentRef.setInput('workspaceId', '');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.detectChanges();

    expect(data.listCatalogs).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-authoring-denied]')
    ).toBeTruthy();
  });
});
