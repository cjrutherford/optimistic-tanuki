import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';
import { CarouselComponent } from './carousel.component';
import { CardComponent } from '../card/card.component';
import { TileComponent } from '../tile/tile.component';

export default {
    title: 'Components/Carousel',
    component: CarouselComponent,
} as Meta;

type Story = StoryObj<CarouselComponent>;

const Template: Story = {
    decorators: [
        componentWrapperDecorator((story) =>
            `<div style="width: 80%; margin: auto; border: 1px solid #ccc; padding: 1rem;">${story}</div>`
        )
    ],
    render: (args) => ({
        props: args,
        template: `
      <lib-carousel [visibleItems]="visibleItems">
        <ng-content></ng-content>
      </lib-carousel>
    `,
    }),
};

export const Default = {
    ...Template,
    args: {
        items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'],
    },
};

export const TwoVisibleItems = {
    ...Template,
    args: {
        items: ['Item A', 'Item B', 'Item C', 'Item D'],
        visibleItems: 2,
    },
    render: (args: CarouselComponent) => ({
        template: `
            <lib-carousel [visibleItems]="visibleItems">
                @for(item of items; track item) {
                    <div class="carousel-item">
                        <div style="padding: 20px; background: lightgray; height: 20vh; padding: 20px 10px; border: 1px solid #ccc;">{{ item }}</div>
                    </div>
                }
            </lib-carousel>
        `,
        props: args,
    }),
};

export const SingleVisibleItem = {
    ...Template,
    args: {
        visibleItems: 1,
    },
    render: () => ({
        template: `
      <lib-carousel [visibleItems]="1">
        <div style="width: 100%; height: 200px; background: lightblue;">Item 1</div>
        <div style="width: 100%; height: 200px; background: lightcoral;">Item 2</div>
        <div style="width: 100%; height: 200px; background: lightgreen;">Item 3</div>
      </lib-carousel>
    `,
    }),
};

export const WithCards = {
    ...Template,
    args: {
        visibleItems: 3,
        items: ['Card 1', 'Card 2', 'Card 3'],
    },
    render: () => ({
        template: `
      <lib-carousel [visibleItems]="3">
        <otui-card *ngFor="let card of ['Card 1', 'Card 2', 'Card 3']">
          {{ card }}
        </otui-card>
      </lib-carousel>
    `,
        moduleMetadata: {
            imports: [CardComponent],
        },
    }),
};

export const WithTiles = {
    ...Template,
    args: {
        visibleItems: 2,
        items: ['Tile A', 'Tile B', 'Tile C'],
    },
    render: () => ({
        template: `
      <lib-carousel [visibleItems]="2">
        <otui-tile *ngFor="let tile of ['Tile A', 'Tile B', 'Tile C']">
          {{ tile }}
        </otui-tile>
      </lib-carousel>
    `,
        moduleMetadata: {
            imports: [TileComponent],
        },
    }),
};

export const PredefinedDimensions = {
    ...Template,
    args: {
        visibleItems: 1,
    },
    render: () => ({
        template: `
      <lib-carousel [visibleItems]="1">
        <div>Custom Content</div>
        <div>Custom Content</div>
      </lib-carousel>
    `,
    }),
};