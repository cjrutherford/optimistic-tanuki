import { ProfileTelosDto } from '@optimistic-tanuki/models';
import { generateProfileTelosMessage } from './profileTelos';

describe('generateProfileTelosMessage', () => {
  it('builds a multi-line summary from the user profile telos', () => {
    const user: ProfileTelosDto = {
      id: 'profile-1',
      name: 'Ada Lovelace',
      projects: [],
      description: 'A mathematician',
      goals: ['advance computing', 'publish research'],
      skills: ['mathematics', 'analysis'],
      interests: ['engines'],
      limitations: ['limited hardware'],
      strengths: ['rigor'],
      objectives: ['finish the algorithm'],
      coreObjective: 'Pioneer computer science',
      overallProfileSummary: 'A visionary mathematician',
    };

    const result = generateProfileTelosMessage(user);

    expect(result).toContain(`User's name is Ada Lovelace.`);
    expect(result).toContain(
      `User's goals are: advance computing, publish research`
    );
    expect(result).toContain(`User's skills are: mathematics, analysis`);
    expect(result).toContain(`User's limitations are: limited hardware`);
    expect(result).toContain(
      `User's core objective is: Pioneer computer science.`
    );
    expect(result.split('\n')).toHaveLength(5);
  });

  it('handles empty arrays gracefully', () => {
    const user: ProfileTelosDto = {
      id: 'profile-2',
      name: 'Empty User',
      projects: [],
      description: '',
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: '',
      overallProfileSummary: '',
    };

    const result = generateProfileTelosMessage(user);

    expect(result).toContain(`User's goals are: `);
    expect(result).toContain(`User's skills are: `);
    expect(result).toContain(`User's limitations are: `);
  });
});
