import { Injectable, Logger } from '@nestjs/common';
import {
  buildGradingRequest,
  enforceEvidence,
  GradeOutcome,
  LlmVerdictSchema,
  WritingResponseActivity,
} from '@optimistic-tanuki/learning-domain';

/**
 * Marks a written answer against the rubric its author wrote.
 *
 * This talks to Ollama directly rather than through prompt-proxy. Reliable
 * marking needs Ollama's structured-output form, where `format` carries a JSON
 * schema, and prompt-proxy's shared DTO types that field as the string 'json'.
 * Widening a contract three other applications depend on, for one caller, is
 * the more expensive change of the two.
 *
 * Nothing this returns is trusted. The model's claims are checked against the
 * learner's actual words in learning-domain before any mark is awarded.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  private get baseUrl(): string {
    return process.env.LEARNING_OLLAMA_URL ?? 'http://shangrila:11434';
  }

  private get model(): string {
    return process.env.LEARNING_GRADING_MODEL ?? 'granite4:tiny-h';
  }

  private get timeoutMs(): number {
    const parsed = Number.parseInt(
      process.env.LEARNING_GRADING_TIMEOUT_MS ?? '',
      10
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
  }

  /**
   * Marks an answer, or reports that it could not be marked.
   *
   * A grader that is unreachable, slow, or talking nonsense must not award
   * anything and must not lose the learner's work either. Every failure here
   * returns undefined, and the caller records the attempt unmarked for a
   * person to look at.
   */
  async gradeWriting(
    activity: WritingResponseActivity,
    submission: string
  ): Promise<GradeOutcome | undefined> {
    const rubric = activity.rubric;
    if (!rubric) return undefined;

    // Measured against the live model: roughly one call in three came back
    // with truncated JSON. One retry turns that into a rare failure rather
    // than a common one, and costs a few seconds only when it happens.
    return (
      (await this.attemptGrading(activity, submission)) ??
      (await this.attemptGrading(activity, submission))
    );
  }

  private async attemptGrading(
    activity: WritingResponseActivity,
    submission: string
  ): Promise<GradeOutcome | undefined> {
    const rubric = activity.rubric;
    if (!rubric) return undefined;

    const request = buildGradingRequest(activity, submission);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: request.schema,
          // Marking should not vary between two identical answers.
          options: { temperature: 0 },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Grading model answered ${response.status}; leaving the answer unmarked`
        );
        return undefined;
      }
      const body = (await response.json()) as {
        message?: { content?: string };
      };
      const content = body.message?.content;
      if (!content) return undefined;

      const parsed = LlmVerdictSchema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        this.logger.warn(
          `Grading model returned something unusable: ${parsed.error.message}`
        );
        return undefined;
      }
      return enforceEvidence(parsed.data, rubric, submission);
    } catch (error) {
      // Includes the abort. An answer is never lost because marking failed.
      this.logger.warn(
        `Could not mark an answer: ${(error as Error)?.message ?? error}`
      );
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
}
