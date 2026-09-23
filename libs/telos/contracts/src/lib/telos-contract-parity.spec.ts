import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  CreatePersonaTelosDto,
  CreateProfileTelosDto,
  CreateProjectTelosDto,
  PersonaTelosCommands,
  PersonaTelosDto,
  ProfileTelosDto,
  ProjectTelosCommands,
  ProjectTelosDto,
  ProfileTelosCommands,
  QueryPersonaTelsosDto,
  UpdatePersonaTelosDto,
} from '../index';

const PERSONA = {
  id: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
  name: 'Ada',
  description: 'A patient tutor',
  goals: ['teach'],
  skills: ['patience'],
  interests: ['learning'],
  limitations: ['none'],
  strengths: ['clarity'],
  objectives: ['help'],
  coreObjective: 'help learners',
  exampleResponses: ['Hello!'],
  promptTemplate: 'You are Ada. {{input}}',
};

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('telos-contract-parity', () => {
  it('validates a full persona both ways', async () => {
    expect(await validate(plainToInstance(PersonaTelosDto, PERSONA))).toEqual(
      []
    );
    expect(
      propsOf(await validate(plainToInstance(PersonaTelosDto, {})))
    ).toEqual(
      expect.arrayContaining(['id', 'name', 'description', 'coreObjective'])
    );
  });

  it('validates create/update/query variants', async () => {
    const { id: _id, ...create } = PERSONA;
    expect(
      await validate(plainToInstance(CreatePersonaTelosDto, create))
    ).toEqual([]);
    expect(
      propsOf(
        await validate(plainToInstance(UpdatePersonaTelosDto, { name: 'Ada' }))
      )
    ).toEqual(['id']);
    expect(await validate(plainToInstance(QueryPersonaTelsosDto, {}))).toEqual(
      []
    );
  });

  it('declares exactly the five persona commands', () => {
    expect(PersonaTelosCommands).toEqual({
      CREATE: 'PERSONA:CREATE',
      UPDATE: 'PERSONA:UPDATE',
      DELETE: 'PERSONA:DELETE',
      FIND: 'PERSONA:FIND',
      FIND_ONE: 'PERSONA:FIND_ONE',
    });
  });

  it('declares the profile/project command families', () => {
    expect(ProfileTelosCommands).toEqual({
      CREATE: 'PROFILE:CREATE',
      UPDATE: 'PROFILE:UPDATE',
      DELETE: 'PROFILE:DELETE',
      FIND: 'PROFILE:FIND',
      FIND_ONE: 'PROFILE:FIND_ONE',
    });
    expect(ProjectTelosCommands).toEqual({
      CREATE: 'PROJECT:CREATE',
      UPDATE: 'PROJECT:UPDATE',
      DELETE: 'PROJECT:DELETE',
      FIND: 'PROJECT:FIND',
      FIND_ONE: 'PROJECT:FIND_ONE',
    });
  });

  it('validates profile/project DTOs', async () => {
    const profile = {
      id: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      name: 'Ada',
      description: 'A patient tutor',
      goals: ['teach'],
      skills: ['patience'],
      interests: ['learning'],
      limitations: ['none'],
      strengths: ['clarity'],
      objectives: ['help'],
      coreObjective: 'help learners',
      overallProfileSummary: 'Ada helps learners.',
      projects: [],
    };
    expect(await validate(plainToInstance(ProfileTelosDto, profile))).toEqual(
      []
    );
    expect(
      propsOf(await validate(plainToInstance(ProfileTelosDto, {})))
    ).toEqual(expect.arrayContaining(['id', 'name']));
    const project = {
      id: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      profile: {},
      name: 'Course',
      description: 'A course',
      goals: ['teach'],
      skills: ['patience'],
      interests: ['learning'],
      limitations: ['none'],
      strengths: ['clarity'],
      objectives: ['help'],
      coreObjective: 'help learners',
      overallProjectSummary: 'A course.',
    };
    expect(await validate(plainToInstance(ProjectTelosDto, project))).toEqual(
      []
    );
    const { id: _id, ...createProfile } = profile;
    expect(
      await validate(plainToInstance(CreateProfileTelosDto, createProfile))
    ).toEqual([]);
    const { id: _pid, ...createProject } = project;
    expect(
      await validate(plainToInstance(CreateProjectTelosDto, createProject))
    ).toEqual([]);
  });
});
