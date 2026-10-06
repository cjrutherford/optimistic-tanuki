import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FoundationQuarantineSchema,
  sha256,
} from '@optimistic-tanuki/civic-core';

/**
 * Records why a record could not be used, so a gap in an edition can be
 * explained rather than guessed at.
 *
 * Identity is deliberate: stage, source, run, the record involved, and a hash
 * of the message. Repeating the same failure within a run must not pile up
 * rows, and a later diagnostic must never overwrite the original error.
 */
@Injectable()
export class QuarantineService {
  constructor(
    @InjectRepository(FoundationQuarantineSchema)
    private readonly quarantine: Repository<Record<string, unknown>>
  ) {}

  async record(
    sourceId: string,
    stage: string,
    error: unknown,
    payload?: string,
    metadata?: { runId?: number; scopeSlug?: string },
    recordIdentity?: string
  ): Promise<void> {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error);
    const targetKey = `${stage}:${sourceId}:${
      metadata?.runId ?? 'diagnostic'
    }:${recordIdentity ?? 'cycle'}:${sha256(message)}`;
    if (await this.quarantine.findOneBy({ targetType: 'pipeline', targetKey }))
      return;
    try {
      await this.quarantine.save({
        sourceId,
        stage,
        error: message,
        createdAt: new Date().toISOString(),
        targetType: 'pipeline',
        targetKey,
        scopeSlug: metadata?.scopeSlug ?? null,
        runId: metadata?.runId === undefined ? null : String(metadata.runId),
        retryable: false,
        payloadRef: payload ?? null,
      });
    } catch (failure) {
      // Two writers can reach the same stable identity at once. That row is
      // already the record of this failure; losing the race changes nothing.
      if (!/unique|constraint|duplicate/iu.test(String(failure))) throw failure;
    }
  }
}
