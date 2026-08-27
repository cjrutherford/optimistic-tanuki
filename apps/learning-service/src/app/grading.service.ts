import { Injectable, Logger } from '@nestjs/common';
import {
  buildGradingRequest,
  buildIntentRequest,
  enforceEvidence,
  GradeOutcome,
  IntentVerdict,
  IntentVerdictSchema,
  LlmVerdictSchema,
  shouldGrade,
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

  /**
   * Chosen by measurement against the roster on the inference host, on the
   * real grading prompt, with one strong answer and four that should earn
   * nothing.
   *
   *   model                     strong answer   quotes the reference   secs
   *   granite4:tiny-h           1/10            yes                    3-42
   *   llama3.2:3b               10/10           yes                    28
   *   nemotron-3-nano:4b-q8_0   10/10           no                     11-49
   *   qwen3:8b                  10/10           no                     75-116
   *   qwen3.5:4b-q8_0           unparseable: spends every token reasoning
   *
   * All of them correctly gave nothing to the weak, off-topic, empty and
   * injected answers, so the difference is entirely in whether an honest
   * answer gets its marks.
   *
   * granite was under-marking real work badly, and quoting the author's
   * reference answer as evidence despite being told twice not to. That
   * evidence is not in the submission, so it verifies as false and the marks
   * vanish: 1/10 for an answer naming three concrete signals. The fix was a
   * model that follows the instruction, not a better instruction.
   *
   * nemotron over qwen3:8b for latency. Both mark correctly; one does it in
   * a third of the time.
   */
  private get model(): string {
    return process.env.LEARNING_GRADING_MODEL ?? 'nemotron-3-nano:4b-q8_0';
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

    /*
      Stage one, and it now blocks.

      The evidence check cannot tell an answer from an instruction aimed at
      the marker: in a prompt injection the attack text is the submission, so
      a compliant model quotes the learner's own words back, the quote
      verifies, and full marks follow. That is demonstrated in
      grading.spec.ts, not theorised, and it is what this gate is for.

      It used to only write down what it would have done, because on a
      six-case sample it refused an honest but thin answer, "I think it is
      the delivery one because the address looked wrong", as though it were
      addressed to the marker. A gate that refuses real work is worse than
      the attack it prevents.

      That observation predates the model change. Re-measured against the
      model actually in use: the thin answer above is marked on five runs out
      of five, four other honest answers across two courses are marked, and
      three prompt injections are refused. An empty-but-confident answer and
      an off-topic one are marked and score zero, which is the wanted
      behaviour rather than a miss: a wrong answer deserves a nought, not a
      refusal.

      The remaining way this refuses honest work is an unreadable verdict,
      which shouldGrade treats as "do not mark". Twenty consecutive calls
      came back readable, because this schema is two fields rather than a
      whole rubric, but there is a retry below regardless. A refusal is not a
      lost answer, it is recorded for a person to mark, so the cost of being
      wrong here is a slower response rather than a missing one.
    */
    const verdict = await this.classifyIntent(activity, submission);
    if (!shouldGrade(verdict, submission)) {
      this.logger.warn(
        `Triage refused to mark this submission: ` +
          `addressesTheMarker=${verdict?.addressesTheMarker ?? 'unreadable'} ` +
          `quote=${JSON.stringify(verdict?.quote ?? '')}`
      );
      return undefined;
    }

    // Measured against the live model: roughly one call in three came back
    // with truncated JSON. One retry turns that into a rare failure rather
    // than a common one, and costs a few seconds only when it happens.
    return (
      (await this.attemptGrading(activity, submission)) ??
      (await this.attemptGrading(activity, submission))
    );
  }

  /**
   * Stage one: answer, manipulation, or blank.
   *
   * Returns undefined when the model cannot be reached or says something
   * unreadable, and shouldGrade treats that as "do not mark". Failing to
   * classify is not a reason to proceed: the whole point of this call is that
   * marking requires a positive verdict rather than the absence of a negative
   * one.
   */
  private async classifyIntent(
    activity: WritingResponseActivity,
    submission: string
  ): Promise<IntentVerdict | undefined> {
    // One retry, for the same reason the marking call has one. This gate can
    // now refuse, and an unreadable verdict refuses, so a single flaky
    // response should not cost an honest learner their automatic mark.
    return (
      (await this.attemptClassifyIntent(activity, submission)) ??
      (await this.attemptClassifyIntent(activity, submission))
    );
  }

  private async attemptClassifyIntent(
    activity: WritingResponseActivity,
    submission: string
  ): Promise<IntentVerdict | undefined> {
    const request = buildIntentRequest(activity, submission);
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
          // Triage answers a boolean and a short quote. It has no reason to
          // produce more than a couple of sentences, and capping it keeps the
          // gate cheap enough to justify sitting in front of every marking.
          options: { temperature: 0, repeat_penalty: 1.1, num_predict: 256 },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Triage model answered ${response.status}; leaving the answer unmarked`
        );
        return undefined;
      }
      const body = (await response.json()) as {
        message?: { content?: string };
      };
      const content = body.message?.content;
      if (!content) return undefined;

      const parsed = IntentVerdictSchema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        this.logger.warn(
          `Triage returned something unusable: ${parsed.error.message}`
        );
        return undefined;
      }
      if (parsed.data.addressesTheMarker) {
        this.logger.log(
          `Triage says a submission speaks to the marker, quoting: ${parsed.data.quote}`
        );
      }
      return parsed.data;
    } catch (error) {
      this.logger.warn(
        `Could not classify a submission: ${(error as Error)?.message ?? error}`
      );
      return undefined;
    } finally {
      clearTimeout(timer);
    }
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
          options: {
            // Marking should not vary between two identical answers.
            temperature: 0,
            /*
              Greedy decoding is what makes marking reproducible, and it is
              also what made it fail. At temperature 0 this model fell into a
              repetition loop inside the evidence field, repeating the same
              two sentences until it ran out of room: 4.7KB of unterminated
              JSON, done_reason "length", nothing parseable, and the learner
              told their answer could not be marked. Longer answers triggered
              it; the short ones I first tested did not, which is why it
              looked like it worked.

              repeat_penalty breaks the loop without introducing randomness,
              so identical answers still mark identically. Measured on the
              prompt that failed: 4722 chars truncated becomes 1412 chars that
              parse, in 309 tokens rather than the full 1024.
            */
            repeat_penalty: 1.1,
            // And a ceiling, so a loop that survives the penalty costs one
            // failed marking rather than the whole timeout.
            num_predict: 1024,
          },
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
