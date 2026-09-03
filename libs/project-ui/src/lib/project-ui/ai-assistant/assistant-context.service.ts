import { Injectable, signal } from '@angular/core';

/**
 * Which project the assistant is working on, if any.
 *
 * The assistant used to live on the projects page because that is where a
 * project id comes from. Making it available everywhere means the project has
 * to travel to it rather than the other way round, and a page that knows which
 * project is selected is the only thing that can say so.
 *
 * Nothing is required to set this. Away from a project the assistant can still
 * find its way around, because listing projects needs no project.
 */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  private readonly current = signal<{ id: string; name: string } | null>(null);

  readonly project = this.current.asReadonly();

  working(on: { id: string; name: string } | null): void {
    this.current.set(on);
  }

  /** Cleared when leaving a page that set it, so it cannot go stale. */
  clear(): void {
    this.current.set(null);
  }
}
