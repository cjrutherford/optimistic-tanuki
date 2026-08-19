import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS,
  type AppConfiguration,
  type BlockInstance,
} from '@optimistic-tanuki/app-config-models';

import { ConfiguratorEditorWorkspaceComponent } from './configurator-editor-workspace.component';

describe('ConfiguratorEditorWorkspaceComponent', () => {
  let fixture: ComponentFixture<ConfiguratorEditorWorkspaceComponent>;
  let component: ConfiguratorEditorWorkspaceComponent;

  const config: AppConfiguration = {
    id: 'cfg-1',
    name: 'Workspace config',
    description: '',
    domain: 'workspace.local',
    landingPage: {
      layout: 'single-column',
      sections: [
        {
          id: 'cta-1',
          type: 'cta',
          order: 0,
          visible: true,
          title: 'Start here',
          buttonText: 'Start',
          buttonLink: '/start',
        },
      ],
    },
    routes: [],
    features: {
      social: { enabled: false },
      tasks: { enabled: false },
      blogging: {
        enabled: false,
        allowComments: false,
        moderateComments: false,
      },
      projectPlanning: {
        enabled: false,
        showGantt: false,
        showKanban: false,
        allowRisks: false,
      },
    },
    theme: { mode: 'light', personalityId: 'professional' },
    active: true,
  };

  const blocks: BlockInstance[] = [
    {
      id: 'cta-1',
      type: 'cta',
      order: 0,
      enabled: true,
      renderContext: 'landing-page',
      data: { title: 'Start here', buttonText: 'Start', buttonLink: '/start' },
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguratorEditorWorkspaceComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguratorEditorWorkspaceComponent);
    component = fixture.componentInstance;
    component.config = config;
    component.blocks = blocks;
    component.blockDefinitions = APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS;
    component.selectedBlockId = 'cta-1';
    fixture.detectChanges();
  });

  it('bridges a rendered-preview selection to the shared editor selection output', () => {
    const selected = jest.fn();
    component.blockSelected.subscribe(selected);

    component.selectFromPreview('cta-1');

    expect(selected).toHaveBeenCalledWith('cta-1');
  });

  it('opens the responsive inspector without moving persistence policy into the shell', () => {
    component.openResponsiveEditor('inspector');
    fixture.detectChanges();

    expect(component.mobileEditorOpen()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-mobile-editor-sheet]')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('app-schema-block-inspector')
    ).toBeTruthy();
  });
});
