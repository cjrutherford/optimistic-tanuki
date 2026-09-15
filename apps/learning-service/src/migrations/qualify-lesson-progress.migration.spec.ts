import { QualifyLessonProgressByEnrolment1789478981715 } from './1789478981715-QualifyLessonProgressByEnrolment';

describe('QualifyLessonProgressByEnrolment1789478981715', () => {
  it('changes the generated unique index in both directions', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new QualifyLessonProgressByEnrolment1789478981715();

    await migration.up({ query } as never);
    expect(query).toHaveBeenNthCalledWith(
      1,
      'DROP INDEX "public"."IDX_e4d662ff65da77a7cf579536d5"'
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('("profileId", "enrolmentId", "lessonId")')
    );

    query.mockClear();
    await migration.down({ query } as never);

    expect(query).toHaveBeenNthCalledWith(
      1,
      'DROP INDEX "public"."IDX_9a2d7508dd82ec528ac9fadbdd"'
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('GROUP BY "lessonId", "profileId"')
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('jsonb_array_elements_text')
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('("lessonId", "profileId")')
    );
  });
});
