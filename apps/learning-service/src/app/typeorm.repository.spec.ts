import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import {
  ProgramTrack,
  builtInProgramTracks,
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
   * replacement for the built-in tracks, then filtered out anything with no
   * upstream repositoryUrl. An authored track has no repositoryUrl, so
   * authoring one course took the catalog from four tracks to zero.
   *
   * These compare against builtInProgramTracks rather than the ported four,
   * because a course written in this workspace is just as built-in as one
   * that came from a repository, and the catalog has to keep both.
   */
  describe('listPrograms', () => {
    it('returns the built-in tracks when nothing has been authored', async () => {
      const repo = await withStoredRows([]);

      const programs = await repo.listPrograms();

      expect(programs.map((program) => program.id).sort()).toEqual(
        builtInProgramTracks.map((program) => program.id).sort()
      );
    });

    it('keeps every built-in track once an unrelated course has been authored', async () => {
      const repo = await withStoredRows([
        { trackId: 'authored-1', data: watercolourTrack },
      ]);

      const programs = await repo.listPrograms();
      const ids = programs.map((program) => program.id);

      for (const builtIn of builtInProgramTracks) {
        expect(ids).toContain(builtIn.id);
      }
      expect(ids).toContain('authored-1');
      expect(programs).toHaveLength(builtInProgramTracks.length + 1);
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
      for (const builtIn of builtInProgramTracks) {
        expect(ids).toContain(builtIn.id);
      }
    });

    it('lets a stored row shadow a built-in track with the same id', async () => {
      const builtInId = builtInProgramTracks[0].id;
      const repo = await withStoredRows([
        {
          trackId: builtInId,
          data: {
            ...builtInProgramTracks[0],
            displayName: 'Edited by an admin',
          },
        },
      ]);

      const programs = await repo.listPrograms();

      expect(
        programs.find((program) => program.id === builtInId)?.displayName
      ).toBe('Edited by an admin');
      expect(programs).toHaveLength(builtInProgramTracks.length);
    });
  });
  /**
   * Where an authored course's lessons are actually written down.
   *
   * The offering lives inside a track's JSONB blob, so saving a lesson means
   * rewriting the offering. This is the only place an author's structure is
   * validated before it is stored.
   */
  describe('updateOfferingContent', () => {
    const storedTrack = {
      id: 'art-1',
      displayName: 'Intro to Watercolour',
      subjectIds: ['art'],
      focuses: [{ id: 'f', displayName: 'Art', subjectIds: ['art'] }],
      offerings: [
        {
          id: 'art-1',
          type: 'course',
          displayName: 'Intro to Watercolour',
          audience: 'People who want a practical start.',
          outcome: 'Mix three pigments deliberately.',
          subjectId: 'art',
          level: 100,
          credits: 1,
          outcomeTags: ['art'],
          status: 'draft',
          modules: [],
          activities: [],
        },
      ],
      requirements: {
        id: 'r',
        operator: 'AND',
        children: [{ kind: 'offering', offeringId: 'art-1' }],
      },
    };

    const lesson = {
      id: 'art-lesson-1',
      title: 'Three pigments',
      slug: 'three-pigments',
      content: [{ format: 'markdown' as const, body: '# Three pigments' }],
    };

    async function repositoryWithStoredOffering() {
      const entity = {
        trackId: 'art-1',
        displayName: 'Intro to Watercolour',
        data: structuredClone(storedTrack),
      };
      const save = jest.fn(async (row: unknown) => row);
      const repo = await buildRepository({
        programTrack: {
          findOne: jest.fn().mockResolvedValue(entity),
          save,
        } as FakeRepository<ProgramTrackEntity>,
      });
      return { repo, save, entity };
    }

    it('writes an authored lesson into the offering', async () => {
      const { repo, save } = await repositoryWithStoredOffering();

      const track = await repo.updateOfferingContent('art-1', {
        modules: [{ id: 'm', title: 'Pigments', lessons: [lesson] }],
      });

      expect(track.offerings[0].modules[0].lessons[0].content).toEqual([
        { format: 'markdown', body: '# Three pigments' },
      ]);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('publishes without touching the content', async () => {
      const { repo } = await repositoryWithStoredOffering();

      const track = await repo.updateOfferingContent('art-1', {
        status: 'published',
      });

      expect(track.offerings[0].status).toBe('published');
      expect(track.offerings[0].displayName).toBe('Intro to Watercolour');
    });

    it('preserves the full authored document across save, publish, metadata, and unpublish', async () => {
      const { repo } = await repositoryWithStoredOffering();
      const modules = [
        {
          id: 'm',
          title: 'Pigments',
          lessons: [lesson],
        },
      ];
      const activities = [
        {
          id: 'code-1',
          type: 'code.run' as const,
          prompt: 'Print the answer.',
          lessonId: lesson.id,
          starterCode: 'console.log("ok")',
          languageId: 'typescript' as const,
          expectedOutput: 'ok',
        },
      ];

      await repo.updateOfferingContent('art-1', { modules, activities });
      await repo.updateOfferingContent('art-1', {
        description: 'Metadata-only updates keep the document.',
      });
      const published = await repo.updateOfferingContent('art-1', {
        status: 'published',
      });
      expect(published.offerings[0].modules).toEqual(modules);
      expect(published.offerings[0].activities).toEqual(activities);

      const unpublished = await repo.updateOfferingContent('art-1', {
        status: 'draft',
      });
      expect(unpublished.offerings[0].modules).toEqual(modules);
      expect(unpublished.offerings[0].activities).toEqual(activities);
      expect(unpublished.offerings[0].activities[0]).toHaveProperty(
        'expectedOutput',
        'ok'
      );
    });

    it('preserves optional copy when it is omitted from a patch', async () => {
      const { repo } = await repositoryWithStoredOffering();

      const track = await repo.updateOfferingContent('art-1', {
        displayName: 'Watercolour Fundamentals',
      });

      expect(track.offerings[0].audience).toBe(
        'People who want a practical start.'
      );
      expect(track.offerings[0].outcome).toBe(
        'Mix three pigments deliberately.'
      );
    });

    it('updates trimmed non-empty optional copy', async () => {
      const { repo } = await repositoryWithStoredOffering();

      const track = await repo.updateOfferingContent('art-1', {
        audience: 'Curious beginners.',
        outcome: 'Mix three pigments deliberately.',
      });

      expect(track.offerings[0].audience).toBe('Curious beginners.');
      expect(track.offerings[0].outcome).toBe(
        'Mix three pigments deliberately.'
      );
    });

    it('clears one optional field without changing the other or restoring it on reload', async () => {
      const { repo, entity } = await repositoryWithStoredOffering();

      const cleared = await repo.updateOfferingContent('art-1', {
        audience: null,
      });

      expect(cleared.offerings[0].audience).toBeUndefined();
      expect(cleared.offerings[0].outcome).toBe(
        'Mix three pigments deliberately.'
      );

      const reloaded = await repo.updateOfferingContent('art-1', {
        displayName: 'Still a draft',
      });

      expect(reloaded.offerings[0].audience).toBeUndefined();
      expect(
        (entity.data as { offerings: Array<{ audience?: string }> })
          .offerings[0].audience
      ).toBeUndefined();
    });

    // Content arrives from an author, so this is the boundary where it is
    // checked. Storing a lesson with no words would fail when a reader opened
    // it, long after whoever wrote it had moved on.
    it('refuses a lesson with neither a body nor a source path', async () => {
      const { repo, save } = await repositoryWithStoredOffering();

      await expect(
        repo.updateOfferingContent('art-1', {
          modules: [
            {
              id: 'm',
              title: 'Pigments',
              lessons: [{ ...lesson, content: [{ format: 'markdown' }] }],
            },
          ],
        } as never)
      ).rejects.toThrow(/sourcePath or a body/);
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses a lesson that carries both a body and a path', async () => {
      const { repo } = await repositoryWithStoredOffering();

      await expect(
        repo.updateOfferingContent('art-1', {
          modules: [
            {
              id: 'm',
              title: 'Pigments',
              lessons: [
                {
                  ...lesson,
                  content: [
                    { format: 'markdown', body: 'words', sourcePath: 'a.md' },
                  ],
                },
              ],
            },
          ],
        } as never)
      ).rejects.toThrow(/sourcePath or a body/);
    });

    describe('deleteOffering', () => {
      it('deletes the track and ownership together', async () => {
        const deleteTrack = jest.fn().mockResolvedValue({ affected: 1 });
        const deleteOwnership = jest.fn().mockResolvedValue({ affected: 1 });
        const transaction = jest.fn(
          async (work: (manager: unknown) => unknown) =>
            await work({
              delete: jest
                .fn()
                .mockImplementationOnce(deleteTrack)
                .mockImplementationOnce(deleteOwnership),
            })
        );
        const manager = { transaction } as never;
        const repo = await buildRepository({
          programTrack: {
            manager,
          } as FakeRepository<ProgramTrackEntity>,
        });

        await repo.deleteOffering('authored-1');

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(deleteTrack).toHaveBeenCalledWith(ProgramTrackEntity, {
          trackId: 'authored-1',
        });
        expect(deleteOwnership).toHaveBeenCalledWith(OfferingOwnershipEntity, {
          offeringId: 'authored-1',
        });
      });

      it('reports a missing track without deleting ownership', async () => {
        const deleteRow = jest.fn().mockResolvedValue({ affected: 0 });
        const transaction = jest.fn(
          async (work: (manager: unknown) => unknown) =>
            await work({ delete: deleteRow })
        );
        const manager = { transaction } as never;
        const repo = await buildRepository({
          programTrack: {
            manager,
          } as FakeRepository<ProgramTrackEntity>,
        });

        await expect(repo.deleteOffering('missing')).rejects.toBeInstanceOf(
          NotFoundException
        );
        expect(deleteRow).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('recordSolvedExercise', () => {
    /**
     * The point of this method is that it never reads before it writes. A
     * read-then-write lost an award whenever two exercises in one lesson were
     * solved at the same time, so a test that only checked the returned value
     * would pass on the broken version too.
     */
    it('merges in a single statement rather than reading first', async () => {
      const query = jest.fn().mockResolvedValue([
        {
          lessonId: 'lesson-1',
          offeringId: 'offering-1',
          completed: false,
          completedExerciseIds: ['ex-1'],
          points: 20,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      const findOne = jest.fn();
      const save = jest.fn();
      const repo = await buildRepository({
        lessonProgress: { query, findOne, save } as never,
      });

      const progress = await repo.recordSolvedExercise(
        'profile-1',
        'user-1',
        'enrolment-1',
        'lesson-1',
        { id: 'ex-1', points: 20 }
      );

      expect(findOne).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(query).toHaveBeenCalledTimes(1);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain(
        'ON CONFLICT ("profileId", "enrolmentId", "lessonId") DO UPDATE'
      );
      // Containment is what makes a repeat submission add nothing twice.
      expect(sql).toContain('@> $5::jsonb');
      expect(params).toEqual([
        'user-1',
        'profile-1',
        'enrolment-1',
        'lesson-1',
        '["ex-1"]',
        20,
      ]);
      expect(progress).toEqual({
        lessonId: 'lesson-1',
        offeringId: 'offering-1',
        completed: false,
        completedExerciseIds: ['ex-1'],
        points: 20,
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    describe('saveProgress', () => {
      it('updates completion atomically without overwriting earned progress', async () => {
        const query = jest.fn().mockResolvedValue([
          {
            lessonId: 'lesson-1',
            offeringId: 'offering-1',
            completed: true,
            completedExerciseIds: ['exercise-1'],
            points: 25,
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ]);
        const repo = await buildRepository({
          lessonProgress: { query } as never,
        });

        const progress = await repo.saveProgress(
          'profile-1',
          'user-1',
          'enrolment-1',
          {
            lessonId: 'lesson-1',
            offeringId: 'offering-1',
            completed: true,
            completedExerciseIds: [],
            points: 0,
          }
        );

        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain(
          'ON CONFLICT ("profileId", "enrolmentId", "lessonId") DO UPDATE'
        );
        expect(sql).toContain('"completed" = EXCLUDED."completed"');
        expect(sql).not.toMatch(
          /DO UPDATE SET[\s\S]*"completedExerciseIds"\s*=\s*EXCLUDED/
        );
        expect(sql).not.toMatch(/DO UPDATE SET[\s\S]*"points"\s*=\s*EXCLUDED/);
        expect(sql).toContain('enrolment."offeringId"');
        expect(params).toEqual([
          'user-1',
          'profile-1',
          'enrolment-1',
          'lesson-1',
          true,
        ]);
        expect(progress).toEqual({
          lessonId: 'lesson-1',
          offeringId: 'offering-1',
          completed: true,
          completedExerciseIds: ['exercise-1'],
          points: 25,
          updatedAt: '2026-01-02T00:00:00.000Z',
        });
      });
    });
  });
});
