import { ProjectTelosDto } from '@optimistic-tanuki/models';
import { generateProjectTelosMessage } from './projectTelos';

describe('generateProjectTelosMessage', () => {
  it('builds a multi-line summary from the project telos', () => {
    const project = {
      id: 'project-1',
      profile: undefined,
      name: 'Analytical Engine',
      description: 'A mechanical computer',
      goals: ['compute numbers', 'automate calculation'],
      skills: ['engineering', 'mathematics'],
      interests: ['machinery'],
      limitations: ['manual crank'],
      strengths: ['precision'],
      objectives: ['finish prototype'],
      coreObjective: 'Build the first general-purpose computer',
      overallProjectSummary: 'A groundbreaking mechanical computer',
    } as unknown as ProjectTelosDto;

    const result = generateProjectTelosMessage(project);

    expect(result).toContain(`Project's name is Analytical Engine.`);
    expect(result).toContain(
      `Project's goals are: compute numbers, automate calculation`
    );
    expect(result).toContain(`Project's skills are: engineering, mathematics`);
    expect(result).toContain(`Project's limitations are: manual crank`);
    expect(result).toContain(
      `Project's core objective is: Build the first general-purpose computer.`
    );
    expect(result.split('\n')).toHaveLength(5);
  });

  it('handles empty arrays gracefully', () => {
    const project = {
      id: 'project-2',
      profile: undefined,
      name: '',
      description: '',
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: '',
      overallProjectSummary: '',
    } as unknown as ProjectTelosDto;

    const result = generateProjectTelosMessage(project);

    expect(result).toContain(`Project's goals are: `);
    expect(result).toContain(`Project's skills are: `);
    expect(result).toContain(`Project's limitations are: `);
  });
});
