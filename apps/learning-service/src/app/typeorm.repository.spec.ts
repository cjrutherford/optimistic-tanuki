import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import {
  ProgramTrack,
  tutorialProgramTracks,
} from '@optimistic-tanuki/learning-domain';
import { TypeOrmLearningRepository } from './typeorm.repository';
import { AttemptEntity } from '../entities/attempt.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { OfferingOwnershipEntity } from '../entities/offering-ownership.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';

/**
 * A stand-in for a TypeORM repository.
 *
 * Typed as a partial of the real thing rather than cast away, so a fake that
 * does not match the shape it is standing in for fails here instead of at
 * runtime. Only the methods a test actually exercises need to be present.
 */
type FakeRepository<T extends object> = Partial<Repository<T>>;

interface Fakes {
  programTrack?: FakeRepository<ProgramTrackEntity>;
  attempt?: FakeRepository<AttemptEntity>;
  evaluation?: FakeRepository<EvaluationEntity>;
  lessonProgress?: FakeRepository<LessonProgressEntity>;
  enrolment?: FakeRepository<EnrolmentEntity>;
  offeringOwnership?: FakeRepository<OfferingOwnershipEntity>;
}

/**
 * Builds the repository through Nest, so the collaborators arrive by their
 * injection tokens rather than by position.
 *
 * Constructing it with `new` and a row of positional placeholders is what an
 * earlier version of this file did, and it hid a real defect: a constructor
 * argument that Nest could not resolve still passed every test here while the
 * service refused to start. Going through the injector means a wiring mistake
 * fails a test.
 */
async function buildRepository(fakes: Fakes = {}) {
  const provide = <T extends object>(
    entity: new () => T,
    fake: FakeRepository<T> | undefined
  ) => ({ provide: getRepositoryToken(entity), useValue: fake ?? {} });

  const moduleRef = await Test.createTestingModule({
    providers: [
      TypeOrmLearningRepository,
      provide(ProgramTrackEntity, fakes.programTrack),
      provide(AttemptEntity, fakes.attempt),
      provide(EvaluationEntity, fakes.evaluation),
      provide(LessonProgressEntity, fakes.lessonProgress),
      provide(EnrolmentEntity, fakes.enrolment),
      provide(OfferingOwnershipEntity, fakes.offeringOwnership),
    ],
  }).compile();

  return moduleRef.get(TypeOrmLearningRepository);
}

function withStoredRows(rows: Array<{ trackId: string; data: unknown }>) {
  return buildRepository({
    programTrack: {
      find: jest.fn().mockResolvedValue(rows),
    } as FakeRepository<ProgramTrackEntity>,
  });
}

const watercolourTrack = {
  id: 'authored-1',
  displayName: 'Intro to Watercolour',
  subjectIds: ['art'],
  supportedLanguageIds: ['any'],
  focuses: [{ id: 'f', displayName: 'Art', subjectIds: ['art'] }],
  offerings: [
    {
      id: 'authored-1',
      type: 'course',
      displayName: 'Intro to Watercolour',
      subjectId: 'art',
      level: 100,
      credits: 1,
      outcomeTags: ['draft'],
      modules: [
        {
          id: 'm',
          title: 'm',
          lessons: [
            {
              id: 'l',
              title: 'l',
              slug: 'l',
              languageVariants: [
                {
                  languageId: 'any',
                  strategy: 'fenced-blocks',
                  sourcePath: 'x',
                },
              ],
            },
          ],
        },
      ],
      activities: [{ type: 'writing.response', id: 'a', prompt: 'p' }],
    },
  ],
  requirements: {
    id: 'r',
    operator: 'AND',
    children: [{ kind: 'offering', offeringId: 'authored-1' }],
  },
} as unknown as ProgramTrack;

/**
 * A track written before the language axis was taken out of the core. The
 * lesson names its renditions `languageVariants`, and the track carries no
 * variantAxis and no contentCollection.
 */
const legacyTrack = {
  id: 'legacy-1',
  displayName: 'Legacy Course',
  subjectIds: ['programming'],
  supportedLanguageIds: ['go'],
  focuses: [{ id: 'f', displayName: 'F', subjectIds: ['programming'] }],
  offerings: [
    {
      id: 'legacy-1',
      type: 'course',
      displayName: 'Legacy Course',
      subjectId: 'programming',
      level: 100,
      credits: 1,
      outcomeTags: ['legacy'],
      modules: [
        {
          id: 'm',
          title: 'm',
          lessons: [
            {
              id: 'l',
              title: 'l',
              slug: 'l',
              languageVariants: [
                { languageId: 'go', strategy: 'file-variant', sourcePath: 'x' },
              ],
            },
          ],
        },
      ],
      activities: [{ type: 'writing.response', id: 'a', prompt: 'p' }],
    },
  ],
  requirements: {
    id: 'r',
    operator: 'AND',
    children: [{ kind: 'offering', offeringId: 'legacy-1' }],
  },
};

describe('TypeOrmLearningRepository', () => {
  // Wiring, not behaviour. The class takes six collaborators by injection
  // token, and nothing else in this file would notice if one of them stopped
  // resolving.
  it('can be constructed through the injector', async () => {
    await expect(buildRepository()).resolves.toBeInstanceOf(
      TypeOrmLearningRepository
    );
  });

  /**
   * The old listPrograms treated a non-empty program_track table as a full
   * replacement for the four built-in tracks, then filtered out anything with
   * no upstream repositoryUrl. An authored track has no repositoryUrl, so
   * authoring one course took the catalog from four tracks to zero.
   */
  describe('listPrograms', () => {
    it('returns the built-in tracks when nothing has been authored', async () => {
      const repo = await withStoredRows([]);

      const programs = await repo.listPrograms();

      expect(programs.map((program) => program.id).sort()).toEqual(
        tutorialProgramTracks.map((program) => program.id).sort()
      );
    });

    it('keeps every built-in track once an unrelated course has been authored', async () => {
      const repo = await withStoredRows([
        { trackId: 'authored-1', data: watercolourTrack },
      ]);

      const programs = await repo.listPrograms();
      const ids = programs.map((program) => program.id);

      for (const builtIn of tutorialProgramTracks) {
        expect(ids).toContain(builtIn.id);
      }
      expect(ids).toContain('authored-1');
      expect(programs).toHaveLength(tutorialProgramTracks.length + 1);
    });

    it('does not discard a track that has no upstream repository', async () => {
      const repo = await withStoredRows([
        { trackId: 'authored-1', data: watercolourTrack },
      ]);

      const programs = await repo.listPrograms();

      expect(
        programs.find((program) => program.id === 'authored-1')
      ).toBeDefined();
    });

    /**
     * Tracks are JSONB, so rows written before the language axis came out of
     * the core still hold the old lesson shape. This read path used to cast
     * rather than parse, which would have handed callers a lesson with no
     * `content` at all.
     */
    it('reads a track stored before lessons had content', async () => {
      const repo = await withStoredRows([
        { trackId: 'legacy-1', data: legacyTrack },
      ]);

      const stored = (await repo.listPrograms()).find(
        (program) => program.id === 'legacy-1'
      );

      expect(stored?.offerings[0].modules[0].lessons[0].content).toEqual([
        { variantId: 'go', format: 'file-variant', sourcePath: 'x' },
      ]);
    });

    it('leaves out a row it cannot read rather than blanking the catalog', async () => {
      const repo = await withStoredRows([
        { trackId: 'broken', data: { id: 'broken' } },
        { trackId: 'authored-1', data: watercolourTrack },
      ]);

      const ids = (await repo.listPrograms()).map((program) => program.id);

      expect(ids).not.toContain('broken');
      expect(ids).toContain('authored-1');
      for (const builtIn of tutorialProgramTracks) {
        expect(ids).toContain(builtIn.id);
      }
    });

    it('lets a stored row shadow a built-in track with the same id', async () => {
      const builtInId = tutorialProgramTracks[0].id;
      const repo = await withStoredRows([
        {
          trackId: builtInId,
          data: {
            ...tutorialProgramTracks[0],
            displayName: 'Edited by an admin',
          },
        },
      ]);

      const programs = await repo.listPrograms();

      expect(
        programs.find((program) => program.id === builtInId)?.displayName
      ).toBe('Edited by an admin');
      expect(programs).toHaveLength(tutorialProgramTracks.length);
    });
  });
});
