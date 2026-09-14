import type { Meta, StoryObj } from '@storybook/angular';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular';
import { PersonaService } from '@optimistic-tanuki/persona-ui';
import { of } from 'rxjs';
import { sampleAssistantTurns } from '../project-ui.fixtures';
import { AiAssistantBubbleComponent } from './ai-assistant-bubble.component';

const meta: Meta<AiAssistantBubbleComponent> = {
  component: AiAssistantBubbleComponent,
  title: 'Assistant/AI Assistant Bubble',
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [
        provideHttpClient(),
        { provide: PersonaService, useValue: { getAllPersonas: () => of([]) } },
      ],
    }),
  ],
  args: {
    turns: sampleAssistantTurns,
    working: false,
    doing: [],
    projectName: 'Site relaunch',
    personaName: 'Project coach',
  },
  argTypes: {
    asked: { action: 'asked' },
    cleared: { action: 'cleared' },
    personaChosen: { action: 'personaChosen' },
  },
};

export default meta;
type Story = StoryObj<AiAssistantBubbleComponent>;

export const Conversation: Story = {};
export const Working: Story = {
  args: {
    working: true,
    doing: ['Reading tasks', 'Checking risks'],
    partial: 'The booking API',
  },
};
export const Unavailable: Story = {
  args: { turns: [], unavailable: 'The assistant is offline right now.' },
};
