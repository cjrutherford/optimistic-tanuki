import { Component, signal } from '@angular/core';

/**
 * How the platform actually works, for learners and for authors.
 *
 * This page is deliberately concrete. The activity matrix and the progress
 * flow describe the contracts implemented by learning-domain and the learning
 * service rather than promising features that are only on a roadmap.
 */
@Component({
  selector: 'otlearn-docs-content',
  template: `
    <article class="docs" aria-labelledby="docs-title">
      <header class="lede">
        <p class="eyebrow">Docs / system notes</p>
        <h1 id="docs-title">How this actually works</h1>
        <p class="dek">
          Read the material in the open. Enrol when you want the platform to
          remember the work you do.
        </p>
      </header>

      <div class="docs-layout">
        <nav class="jump" aria-label="On this page">
          <p class="jump-label">On this page</p>
          <button
            type="button"
            [class.active]="activeSection() === 'learners'"
            [attr.aria-pressed]="activeSection() === 'learners'"
            (click)="selectSection('learners', $event)"
          >
            For learners
          </button>
          <button
            type="button"
            [class.active]="activeSection() === 'authors'"
            [attr.aria-pressed]="activeSection() === 'authors'"
            (click)="selectSection('authors', $event)"
          >
            For authors
          </button>
        </nav>

        <div class="docs-body">
          <section
            id="learners"
            class="doc-section"
            aria-labelledby="learners-title"
          >
            <div class="section-heading">
              <p class="section-index">01 / learner path</p>
              <h2 id="learners-title">For learners</h2>
            </div>

            <div class="spec-panel">
              <p class="panel-label">The short version</p>
              <div class="flow-diagram" aria-label="Learner flow">
                <div class="flow-node">
                  <span class="node-index">01</span>
                  <strong>Read</strong>
                  <span>Published lessons are open to browse.</span>
                </div>
                <span class="flow-arrow" aria-hidden="true">→</span>
                <div class="flow-node">
                  <span class="node-index">02</span>
                  <strong>Enrol</strong>
                  <span>Attach progress to a published offering.</span>
                </div>
                <span class="flow-arrow" aria-hidden="true">→</span>
                <div class="flow-node">
                  <span class="node-index">03</span>
                  <strong>Submit</strong>
                  <span>Send work from an active enrolment.</span>
                </div>
                <span class="flow-arrow" aria-hidden="true">→</span>
                <div class="flow-node">
                  <span class="node-index">04</span>
                  <strong>Keep score</strong>
                  <span>Passed work is folded into lesson progress.</span>
                </div>
              </div>
            </div>

            <h3>Reading and enrolment</h3>
            <p>
              Published course material can be opened without an account.
              Reading a lesson and seeing what an activity asks are separate
              from recording work. Enrolment is required before the service
              accepts a submission or writes lesson progress. Submitting work
              does require an active enrolment. Enrolment is only available for
              a published offering.
            </p>

            <h3>The four kinds of work</h3>
            <div class="table-wrap">
              <table>
                <caption>
                  Supported activity types
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">What the platform does</th>
                    <th scope="col">Progress effect</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Multiple choice</th>
                    <td>
                      Checks the selected option ids against the author&rsquo;s
                      correct options in process.
                    </td>
                    <td>
                      A fully correct answer can complete the activity and award
                      its points once.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Written response</th>
                    <td>
                      Uses the author&rsquo;s rubric when one exists. Marking
                      checks that awarded evidence is quoted from the
                      learner&rsquo;s own answer; without a rubric, the attempt
                      waits for a person.
                    </td>
                    <td>
                      A fully marked answer can complete the activity and award
                      its points once.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Project submission</th>
                    <td>
                      Records the submitted work against the artifact types
                      requested by the author. It is left for a person to mark.
                    </td>
                    <td>
                      Recording the attempt alone does not award automatic
                      progress points.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Code run</th>
                    <td>
                      Supports starter code for runnable work. Language
                      challenges run in the service&rsquo;s sandbox; a challenge
                      submission is checked by its verifier.
                    </td>
                    <td>
                      A passing language exercise awards its points once; trying
                      a run is not itself a progress award.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Progress and points</h3>
            <p>
              Progress is scoped to the learner&rsquo;s active enrolment and
              lesson. A progress row keeps the completed activity ids and points
              for that lesson. Passing the same activity again does not add its
              points a second time. Submitting work or writing progress is
              refused when the enrolment is not active; re-enrolling reactivates
              the existing enrolment.
            </p>
            <pre
              class="code-card"
              aria-label="Progress record shape"
            ><code>learner + enrolment + lesson
├─ completed activity ids
├─ lesson complete flag
└─ points earned so far</code></pre>

            <h3>Practice challenges</h3>
            <p>
              The Challenges panel surfaces runnable language exercises from
              enrolled courses. Running code requires a signed-in session and
              checks the code without recording progress. Submitting an exercise
              requires an active enrolment; a passing verifier result records
              the exercise and awards its points once. Draft code is kept
              locally so an unfinished attempt can survive a refresh.
            </p>

            <h3>Offline</h3>
            <p>
              Installing Let&rsquo;s Go puts it on your home screen and keeps
              lessons you have already opened readable without a connection. It
              does not fetch a whole course in advance, and it does not accept
              submitted work while you are offline: those still need a live
              connection to the service that marks or verifies them.
            </p>
          </section>

          <section
            id="authors"
            class="doc-section"
            aria-labelledby="authors-title"
          >
            <div class="section-heading">
              <p class="section-index">02 / author path</p>
              <h2 id="authors-title">For authors</h2>
            </div>

            <div class="spec-panel">
              <p class="panel-label">Course structure</p>
              <div
                class="architecture-grid"
                aria-label="Course structure diagram"
              >
                <div class="architecture-node">
                  <span>Course</span>
                  <small>outline + offerings</small>
                </div>
                <span class="flow-arrow" aria-hidden="true">→</span>
                <div class="architecture-node">
                  <span>Modules</span>
                  <small>ordered groups</small>
                </div>
                <span class="flow-arrow" aria-hidden="true">→</span>
                <div class="architecture-node">
                  <span>Lessons</span>
                  <small>markdown + work</small>
                </div>
              </div>
            </div>

            <h3>Writing a course</h3>
            <p>
              A course is an outline of modules and lessons, each lesson written
              in markdown, with any of the four supported activity types
              attached where work belongs: multiple choice, written response,
              project submission, or code run. Everything is edited in one
              workspace and saved as a whole, so a half-finished lesson does not
              go live by accident while you are still working on the next one.
            </p>

            <h3>Drafts and publishing</h3>
            <p>
              A course starts, and stays, a draft until somebody with the right
              to publish it says otherwise. A draft is visible only to its owner
              and whoever the owner has added as a co-editor; nobody else can
              see it, including in search or the catalog. Co-editors can write
              and revise everything in the course. Publishing and unpublishing
              are the owner&rsquo;s call alone: a co-editor who tries either is
              refused by the server, not just hidden in the interface.
            </p>

            <h3>How marking works</h3>
            <p>
              Multiple choice is graded by a fixed rule: every correct option
              chosen, no incorrect ones, or it is marked wrong. There is no
              model involved and no judgement call.
            </p>
            <p>
              A written answer with a rubric is graded asynchronously against
              the criteria the author wrote. A model proposes points per
              criterion, but the proposal is not trusted on its own: every
              awarded criterion must quote the exact words from the
              learner&rsquo;s answer, and that quotation is checked in code. A
              submission with no rubric, and a project submission, is recorded
              for a person rather than silently marked.
            </p>

            <h3>Writing a rubric that marks well</h3>
            <p>
              Write each criterion as a specific, concrete claim a learner might
              actually put into words, not a quality you are hoping to sense in
              the writing. &ldquo;Names the risk of storing the password in
              plain text&rdquo; can be quoted against. &ldquo;Shows a deep
              understanding of security&rdquo; cannot: there is no particular
              sentence that satisfies it, so the evidence check has nothing to
              hold onto.
            </p>
            <p>
              You may add a reference answer for the marker to read for context.
              It is never shown to the learner and the marker is told explicitly
              not to quote it: only the learner&rsquo;s own words count as
              evidence for their own score.
            </p>
          </section>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .docs {
        width: min(100%, 76rem);
        margin: 0 auto;
        padding: 1rem 0 3.5rem;
      }
      .lede {
        max-width: 68ch;
        margin-bottom: 2.5rem;
      }
      .eyebrow,
      .section-index,
      .panel-label,
      .jump-label {
        margin: 0;
        color: var(--lx-accent);
        font: var(--lx-btn-weight, 800) 0.68rem
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.12em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      h1,
      h2,
      h3 {
        font-family: var(--lx-font-heading);
      }
      h1 {
        margin: 0.6rem 0;
        font-size: clamp(2rem, 4vw, 3.35rem);
        line-height: 1.02;
        letter-spacing: -0.045em;
      }
      .dek {
        max-width: 56ch;
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 1.08rem;
        line-height: 1.65;
      }
      .docs-layout {
        display: grid;
        grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr);
        gap: clamp(1.5rem, 4vw, 4rem);
        align-items: start;
      }
      .jump {
        position: sticky;
        top: 1.25rem;
        display: grid;
        gap: 0.3rem;
        padding: 0.8rem 0;
      }
      .jump-label {
        padding: 0.45rem 0.7rem 0.6rem;
        color: var(--lx-text-subtle);
        font-size: 0.62rem;
      }
      .jump button {
        display: block;
        padding: 0.7rem 0.7rem 0.7rem 0.9rem;
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          transparent;
        border-radius: 0 var(--lx-radius) var(--lx-radius) 0;
        background: transparent;
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight, 800) 0.76rem/1.25
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.04em;
        text-transform: var(--lx-btn-transform, uppercase);
        text-align: left;
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .jump button:hover {
        background: var(--lx-surface-hover);
        color: var(--lx-text);
      }
      .jump button.active {
        border-left-color: var(--lx-accent);
        background: var(--lx-surface-active);
        color: var(--lx-text);
      }
      .jump button:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: -2px;
      }
      .docs-body {
        min-width: 0;
      }
      .doc-section {
        max-width: 72ch;
        scroll-margin-top: 1.5rem;
      }
      .doc-section + .doc-section {
        margin-top: 4rem;
        padding-top: 3rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .section-heading {
        margin-bottom: 1.5rem;
      }
      .section-heading h2 {
        margin: 0.35rem 0 0;
        font-size: clamp(1.6rem, 3vw, 2.2rem);
        letter-spacing: -0.03em;
      }
      h3 {
        margin: 2.25rem 0 0.65rem;
        font-size: 1.08rem;
        line-height: 1.25;
      }
      p {
        margin: 0;
        color: var(--lx-text-body);
        line-height: 1.7;
      }
      .spec-panel,
      .code-card,
      .table-wrap {
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .spec-panel {
        padding: 1rem;
      }
      .panel-label {
        margin-bottom: 1rem;
        color: var(--lx-text-subtle);
        font-size: 0.62rem;
      }
      .flow-diagram,
      .architecture-grid {
        display: flex;
        align-items: stretch;
        gap: 0.55rem;
      }
      .flow-node,
      .architecture-node {
        display: grid;
        flex: 1 1 0;
        gap: 0.3rem;
        min-width: 0;
        padding: 0.75rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-border);
        border-radius: var(--lx-radius);
        background: var(--lx-well);
        box-shadow: var(--lx-shadow-inset);
      }
      .flow-node strong,
      .architecture-node span {
        color: var(--lx-text);
        font: var(--lx-btn-weight, 800) 0.78rem var(--lx-font-mono, monospace);
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .flow-node > span:last-child,
      .architecture-node small {
        color: var(--lx-text-muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }
      .node-index {
        color: var(--lx-accent);
        font: 700 0.62rem var(--lx-font-mono, monospace);
      }
      .flow-arrow {
        align-self: center;
        flex: 0 0 auto;
        color: var(--lx-accent);
        font: 700 1.1rem var(--lx-font-mono, monospace);
      }
      .table-wrap {
        overflow-x: auto;
        box-shadow: var(--lx-shadow-card);
      }
      table {
        width: 100%;
        min-width: 38rem;
        border-collapse: collapse;
        color: var(--lx-text-body);
        font-size: 0.88rem;
        line-height: 1.55;
      }
      caption {
        padding: 0.85rem 1rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border);
        color: var(--lx-text-subtle);
        font: var(--lx-btn-weight, 800) 0.66rem var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-align: left;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      th,
      td {
        padding: 0.8rem 0.9rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        vertical-align: top;
        text-align: left;
      }
      thead th {
        color: var(--lx-text);
        font: var(--lx-btn-weight, 800) 0.68rem var(--lx-font-mono, monospace);
        letter-spacing: 0.05em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      tbody th {
        width: 9rem;
        color: var(--lx-accent);
        font-weight: 700;
      }
      tr:last-child th,
      tr:last-child td {
        border-bottom: 0;
      }
      .code-card {
        overflow-x: auto;
        margin: 1.2rem 0 0;
        padding: 1rem 1.1rem;
        background-color: var(--lx-code);
        color: var(--lx-code-text);
        box-shadow: var(--lx-shadow-inset);
        font: 0.78rem/1.7 var(--lx-font-mono, ui-monospace, monospace);
        white-space: pre;
      }
      .architecture-grid {
        align-items: center;
      }
      .architecture-node {
        text-align: center;
      }
      @media (max-width: 760px) {
        .docs {
          padding-top: 0.3rem;
        }
        .docs-layout {
          display: block;
        }
        .jump {
          position: static;
          display: flex;
          overflow-x: auto;
          gap: 0.35rem;
          margin: 0 -0.2rem 2.25rem;
          padding: 0.2rem;
          scrollbar-width: thin;
        }
        .jump-label {
          display: none;
        }
        .jump button {
          flex: 0 0 auto;
          border: var(--lx-border-width) var(--lx-border-style)
            var(--lx-border-soft);
          border-radius: var(--lx-radius);
          white-space: nowrap;
        }
        .jump button.active {
          border-color: var(--lx-accent);
          box-shadow: var(--lx-shadow-sm);
        }
        .flow-diagram,
        .architecture-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }
        .flow-arrow {
          justify-self: center;
          transform: rotate(90deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .jump button {
          transition: none;
        }
      }
    `,
  ],
})
export class DocsContentComponent {
  readonly activeSection = signal<'learners' | 'authors'>('learners');

  selectSection(section: 'learners' | 'authors', event?: MouseEvent): void {
    event?.preventDefault();
    this.activeSection.set(section);
    const target = document.getElementById(section);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'auto' });
    }
  }
}
