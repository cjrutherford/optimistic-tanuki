import {
  APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS,
  appConfigToConfigDocument,
  createEditorWorkspace,
  insertBlockInWorkspace,
  moveBlockInWorkspace,
  configDocumentToAppConfig,
  normalizeBlockOrder,
  removeBlockFromWorkspace,
  selectBlockInWorkspace,
  updateBlockInWorkspace,
  type AppConfiguration,
  type BlockInstance,
  type BlockDefinition,
  type ConfigDocument,
} from './app-configuration.model';

describe('config document adapters', () => {
  it('converts a legacy app config into normalized landing-page blocks', () => {
    const config: AppConfiguration = {
      id: 'cfg-1',
      name: 'Landing App',
      description: 'Legacy shape',
      domain: 'landing.local',
      landingPage: {
        layout: 'single-column',
        sections: [
          {
            id: 'hero-1',
            type: 'hero',
            order: 4,
            visible: true,
            title: 'Welcome',
            subtitle: 'Subhead',
          },
          {
            id: 'cta-1',
            type: 'cta',
            order: 1,
            visible: false,
            title: 'Join',
            buttonText: 'Start',
            buttonLink: '/start',
          },
        ],
      },
      routes: [],
      features: {
        social: { enabled: true, showPosts: true },
      },
      theme: {
        primaryColor: '#123456',
        mode: 'dark',
        personalityId: 'elegant',
      },
      active: true,
    };

    const document = appConfigToConfigDocument(config);

    expect(document.layout).toBe('single-column');
    expect(document.blocks).toEqual([
      {
        id: 'cta-1',
        type: 'cta',
        order: 0,
        enabled: false,
        renderContext: 'landing-page',
        data: {
          title: 'Join',
          description: undefined,
          buttonText: 'Start',
          buttonLink: '/start',
        },
      },
      {
        id: 'hero-1',
        type: 'hero',
        order: 1,
        enabled: true,
        renderContext: 'landing-page',
        data: {
          title: 'Welcome',
          subtitle: 'Subhead',
          backgroundImage: undefined,
          ctaText: undefined,
          ctaLink: undefined,
        },
      },
    ]);
    expect(document.theme).toEqual(
      expect.objectContaining({
        primaryColor: '#123456',
        mode: 'dark',
        personalityId: 'elegant',
      })
    );
  });

  it('reconstructs a legacy app config from a shared config document', () => {
    const document: ConfigDocument = {
      layout: 'wide',
      routes: [
        {
          id: 'home',
          path: '/',
          name: 'Home',
          componentType: 'landing',
          order: 0,
          showInNav: true,
        },
      ],
      features: {
        blogging: {
          enabled: true,
          allowComments: true,
          moderateComments: false,
        },
      },
      theme: {
        primaryColor: '#abcdef',
      },
      blocks: normalizeBlockOrder([
        {
          id: 'grid-1',
          type: 'grid',
          order: 99,
          enabled: true,
          renderContext: 'landing-page',
          data: {
            title: 'Resources',
            columns: 3,
            items: [{ title: 'Guide', description: 'Read me' }],
          },
        },
        {
          id: 'footer-1',
          type: 'footer',
          order: 2,
          enabled: true,
          renderContext: 'landing-page',
          data: {
            content: 'Footer copy',
            links: [{ text: 'Docs', url: '/docs' }],
          },
        },
      ]),
    };

    const config = configDocumentToAppConfig(document, {
      id: 'cfg-2',
      name: 'Recovered',
      active: true,
    });

    expect(config.id).toBe('cfg-2');
    expect(config.name).toBe('Recovered');
    expect(config.landingPage.layout).toBe('wide');
    expect(config.landingPage.sections).toEqual([
      {
        id: 'footer-1',
        type: 'footer',
        order: 0,
        visible: true,
        content: 'Footer copy',
        links: [{ text: 'Docs', url: '/docs' }],
      },
      {
        id: 'grid-1',
        type: 'grid',
        order: 1,
        visible: true,
        title: 'Resources',
        columns: 3,
        items: [{ title: 'Guide', description: 'Read me' }],
      },
    ]);
  });

  it('normalizes block order by current position', () => {
    const blocks: BlockInstance[] = [
      {
        id: 'second',
        type: 'content',
        order: 20,
        enabled: true,
        data: { content: 'Second' },
      },
      {
        id: 'first',
        type: 'content',
        order: -10,
        enabled: true,
        data: { content: 'First' },
      },
    ];

    expect(normalizeBlockOrder(blocks)).toEqual([
      {
        id: 'first',
        type: 'content',
        order: 0,
        enabled: true,
        data: { content: 'First' },
      },
      {
        id: 'second',
        type: 'content',
        order: 1,
        enabled: true,
        data: { content: 'Second' },
      },
    ]);
  });

  it('tracks selection against the shared canvas workspace', () => {
    const workspace = createEditorWorkspace(
      {
        layout: 'single-column',
        blocks: [
          {
            id: 'hero-1',
            type: 'hero',
            order: 0,
            enabled: true,
            renderContext: 'landing-page',
            data: { title: 'Welcome' },
          },
        ],
      },
      'guided'
    );

    expect(workspace.mode).toBe('guided');
    expect(workspace.selectedBlockId).toBeNull();

    expect(selectBlockInWorkspace(workspace, 'hero-1').selectedBlockId).toBe(
      'hero-1'
    );
  });

  it('inserts, updates, moves, and removes blocks while preserving normalized order', () => {
    const registry: Record<string, BlockDefinition> = {
      hero: {
        type: 'hero',
        name: 'Hero',
        renderContexts: ['landing-page'],
      },
      cta: {
        type: 'cta',
        name: 'CTA',
        renderContexts: ['landing-page'],
      },
    };

    let workspace = createEditorWorkspace({
      layout: 'single-column',
      blocks: [
        {
          id: 'hero-1',
          type: 'hero',
          order: 0,
          enabled: true,
          renderContext: 'landing-page',
          data: { title: 'Welcome' },
        },
      ],
    });

    workspace = insertBlockInWorkspace(
      workspace,
      registry,
      {
        id: 'cta-1',
        type: 'cta',
        order: 99,
        enabled: true,
        renderContext: 'landing-page',
        data: {
          title: 'Join',
          buttonText: 'Start',
          buttonLink: '/start',
        },
      },
      { index: 0, renderContext: 'landing-page' }
    );
    workspace = updateBlockInWorkspace(workspace, 'cta-1', {
      data: {
        title: 'Join today',
        buttonText: 'Launch',
        buttonLink: '/launch',
      },
    });
    workspace = moveBlockInWorkspace(workspace, 'hero-1', 0);

    expect(workspace.document.blocks).toEqual([
      expect.objectContaining({
        id: 'hero-1',
        order: 0,
      }),
      expect.objectContaining({
        id: 'cta-1',
        order: 1,
        data: {
          title: 'Join today',
          buttonText: 'Launch',
          buttonLink: '/launch',
        },
      }),
    ]);

    expect(
      removeBlockFromWorkspace(workspace, 'hero-1').document.blocks
    ).toEqual([
      expect.objectContaining({
        id: 'cta-1',
        order: 0,
      }),
    ]);
  });

  it('enforces registry render-context restrictions for insertions', () => {
    const registry: Record<string, BlockDefinition> = {
      'social-feed': {
        type: 'social-feed',
        name: 'Social Feed',
        renderContexts: ['rich-text'],
      },
    };
    const workspace = createEditorWorkspace({
      layout: 'single-column',
      blocks: [],
    });

    expect(() =>
      insertBlockInWorkspace(
        workspace,
        registry,
        {
          id: 'social-1',
          type: 'social-feed',
          order: 0,
          enabled: true,
          renderContext: 'landing-page',
          data: {},
        },
        { renderContext: 'landing-page' }
      )
    ).toThrow(/render context/i);
  });

  it('exposes schema definitions for landing-page blocks', () => {
    expect(APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS.hero).toEqual(
      expect.objectContaining({
        type: 'hero',
        name: 'Hero',
        category: 'Intro',
        renderContexts: ['landing-page'],
      })
    );

    expect(APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS.hero.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'title',
          type: 'string',
          label: 'Title',
        }),
        expect.objectContaining({
          key: 'subtitle',
          type: 'string',
          label: 'Subtitle',
        }),
      ])
    );

    expect(APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS.content.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'imagePosition',
          type: 'select',
          label: 'Image Position',
        }),
      ])
    );
  });

  it('preserves nested motion and media section fields through config document conversion', () => {
    const config: AppConfiguration = {
      id: 'cfg-rich',
      name: 'Rich Landing App',
      landingPage: {
        layout: 'single-column',
        sections: [
          {
            id: 'hero-rich',
            type: 'hero',
            order: 0,
            visible: true,
            title: 'Welcome',
            subtitle: 'Animated',
            backgroundImage: 'https://cdn.example.com/legacy-hero.jpg',
            background: {
              sourceType: 'asset',
              src: '/assets/hero.jpg',
              alt: 'Hero background',
              caption: 'Editorial hero',
              aspect: 'landscape',
              fit: 'cover',
              focalPoint: 'top',
            },
            motion: {
              kind: 'aurora-ribbon',
              density: 4,
              speed: 1.25,
              intensity: 0.7,
              height: '100%',
              reducedMotion: false,
              direction: 'horizontal',
            },
            ctaText: 'Start',
            ctaLink: '/start',
          },
          {
            id: 'content-rich',
            type: 'content',
            order: 1,
            visible: true,
            title: 'Story',
            content: 'Body copy',
            imageUrl: 'https://cdn.example.com/story.jpg',
            imagePosition: 'left',
            image: {
              sourceType: 'url',
              src: 'https://cdn.example.com/rich-story.jpg',
              alt: 'Story image',
              caption: 'Supporting image',
              aspect: 'portrait',
              fit: 'contain',
              focalPoint: 'right',
            },
            motion: {
              kind: 'signal-mesh',
              density: 5,
            },
          },
        ],
      },
      routes: [],
      features: {},
      theme: {},
      active: true,
    };

    const document = appConfigToConfigDocument(config);
    const roundTrip = configDocumentToAppConfig(document, {
      id: config.id,
      name: config.name,
      active: config.active,
    });

    expect(document.blocks[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          background: expect.objectContaining({
            src: '/assets/hero.jpg',
            fit: 'cover',
            focalPoint: 'top',
          }),
          motion: expect.objectContaining({
            kind: 'aurora-ribbon',
            direction: 'horizontal',
          }),
        }),
      })
    );

    expect(roundTrip.landingPage.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'hero-rich',
          background: expect.objectContaining({
            src: '/assets/hero.jpg',
            fit: 'cover',
          }),
          motion: expect.objectContaining({
            kind: 'aurora-ribbon',
            density: 4,
          }),
        }),
        expect.objectContaining({
          id: 'content-rich',
          image: expect.objectContaining({
            src: 'https://cdn.example.com/rich-story.jpg',
            fit: 'contain',
            focalPoint: 'right',
          }),
          motion: expect.objectContaining({
            kind: 'signal-mesh',
          }),
        }),
      ])
    );
  });

  it('applies nested block data updates without flattening object paths', () => {
    let workspace = createEditorWorkspace({
      layout: 'single-column',
      blocks: [
        {
          id: 'hero-1',
          type: 'hero',
          order: 0,
          enabled: true,
          renderContext: 'landing-page',
          data: {
            title: 'Welcome',
            motion: { kind: 'none' },
            background: { src: '' },
          },
        },
      ],
    });

    workspace = updateBlockInWorkspace(workspace, 'hero-1', {
      data: {
        'motion.kind': 'particle-veil',
        'motion.speed': 1.5,
        'background.src': '/assets/hero.jpg',
        'background.alt': 'Hero image',
      },
    });

    expect(workspace.document.blocks[0]?.data).toEqual(
      expect.objectContaining({
        motion: expect.objectContaining({
          kind: 'particle-veil',
          speed: 1.5,
        }),
        background: expect.objectContaining({
          src: '/assets/hero.jpg',
          alt: 'Hero image',
        }),
      })
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        workspace.document.blocks[0]?.data ?? {},
        'motion.kind'
      )
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        workspace.document.blocks[0]?.data ?? {},
        'background.src'
      )
    ).toBe(false);
  });
});
