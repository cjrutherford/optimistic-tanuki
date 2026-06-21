import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BlockDefinition,
  BlockInstance,
} from '@optimistic-tanuki/app-config-models';

import { SchemaBlockInspectorComponent } from './schema-block-inspector.component';

describe('SchemaBlockInspectorComponent', () => {
  let fixture: ComponentFixture<SchemaBlockInspectorComponent>;
  let component: SchemaBlockInspectorComponent;

  const definition: BlockDefinition = {
    type: 'gallery',
    name: 'Gallery',
    category: 'Media',
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Title',
        editor: 'text',
      },
      {
        key: 'gallery.style',
        type: 'select',
        label: 'Gallery Style',
        editor: 'select',
        options: [
          { label: 'Grid', value: 'grid' },
          { label: 'Masonry', value: 'masonry' },
        ],
      },
      {
        key: 'gallery.columns',
        type: 'number',
        label: 'Columns',
        editor: 'select',
        options: [
          { label: '2 columns', value: 2 },
          { label: '3 columns', value: 3 },
        ],
      },
    ],
    renderContexts: ['landing-page'],
  };

  const block: BlockInstance = {
    id: 'gallery-1',
    type: 'gallery',
    order: 0,
    enabled: true,
    renderContext: 'landing-page',
    data: {
      title: 'Proof Gallery',
      gallery: {
        style: 'grid',
        columns: 3,
      },
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchemaBlockInspectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SchemaBlockInspectorComponent);
    component = fixture.componentInstance;
    component.definition = definition;
    component.block = block;
    fixture.detectChanges();
  });

  it('renders stable ids for select-backed schema fields', () => {
    const styleField = fixture.nativeElement.querySelector(
      '#field-gallery\\.style'
    );
    const columnsField = fixture.nativeElement.querySelector(
      '#field-gallery\\.columns'
    );

    expect(styleField?.tagName).toBe('LIB-SELECT');
    expect(columnsField?.tagName).toBe('LIB-SELECT');
    expect(styleField?.querySelector('select')).toBeTruthy();
    expect(columnsField?.querySelector('select')).toBeTruthy();
  });
});
