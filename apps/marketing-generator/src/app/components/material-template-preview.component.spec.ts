import { TestBed } from '@angular/core/testing';
import { CampaignAsset, MaterialSurface } from '../types';
import { MaterialTemplatePreviewComponent } from './material-template-preview.component';

describe('MaterialTemplatePreviewComponent', () => {
  it('renders rich html blocks inside an advertisement-style preview shell', async () => {
    const asset: CampaignAsset = {
      id: 'asset-1',
      type: 'flyer',
      formatId: 'flyer-letter',
      label: 'Letter Flyer',
      canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
      layoutVariant: 'issue-led',
      templateFamily: 'print-flyer',
      templateName: 'issue-led',
      surfaces: [],
      downloadFileName: 'billing-flyer',
      isPrimary: true,
    };
    const surface: MaterialSurface = {
      id: 'surface-1',
      label: 'Front',
      type: 'front',
      textBlocks: [
        {
          id: 'tb-1',
          role: 'headline',
          label: 'Headline',
          value:
            '<p>Hosted <strong>metering</strong> without bespoke billing plumbing.</p>',
        },
        {
          id: 'tb-2',
          role: 'body',
          label: 'Body',
          value:
            '<p>Usage blocks, invoice previews, and self-hosted Docker options stay visible.</p>',
        },
        {
          id: 'tb-3',
          role: 'body',
          label: 'Badge',
          value: '<3 local-first previews',
        },
      ],
      imageSlots: [],
    };

    await TestBed.configureTestingModule({
      imports: [MaterialTemplatePreviewComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(MaterialTemplatePreviewComponent);
    fixture.componentRef.setInput('asset', asset);
    fixture.componentRef.setInput('surface', surface);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.template-preview')
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Hosted metering without bespoke billing plumbing.'
    );
    expect(fixture.nativeElement.innerHTML).toContain(
      '<strong>metering</strong>'
    );
    expect(fixture.nativeElement.textContent).toContain(
      '<3 local-first previews'
    );
    expect(fixture.nativeElement.innerHTML).toContain(
      '&lt;3 local-first previews'
    );
  });
});
