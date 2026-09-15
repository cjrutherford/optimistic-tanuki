import { Component } from '@angular/core';

/**
 * What Let's Go is, honestly.
 *
 * The page is presentational, but the statements are not aspirational:
 * activity types, marking, enrolment, progress, publishing, and offline
 * behavior all mirror the currently implemented learning contracts.
 */
@Component({
  selector: 'otlearn-about-content',
  template: `
    <article class="about" aria-labelledby="about-title">
      <header class="lede">
        <p class="eyebrow">About / the point of the tool</p>
        <h1 id="about-title">A course is an argument, not a shelf of notes.</h1>
        <p class="dek">
          Let&rsquo;s Go is a place to read a course somebody wrote, do the work
          it sets, and have that work marked against what the author was
          actually asking for. It is not a video library and it is not a wiki:
          every course here has an author who made choices about what matters
          and why.
        </p>
      </header>

      <section class="about-section" aria-labelledby="flow-title">
        <div class="section-heading">
          <p class="section-index">01 / the loop</p>
          <h2 id="flow-title">
            A course makes a case, then gives you somewhere to try it.
          </h2>
        </div>
        <div class="architecture-panel">
          <div class="architecture-flow" aria-label="Learning loop">
            <div class="architecture-node">
              <span class="node-mark">A</span>
              <strong>Author</strong>
              <small>chooses the sequence</small>
            </div>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <div class="architecture-node">
              <span class="node-mark">B</span>
              <strong>Learner</strong>
              <small>reads the lesson</small>
            </div>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <div class="architecture-node">
              <span class="node-mark">C</span>
              <strong>Work</strong>
              <small>answers or builds</small>
            </div>
            <span class="flow-arrow" aria-hidden="true">→</span>
            <div class="architecture-node">
              <span class="node-mark">D</span>
              <strong>Evidence</strong>
              <small>feedback and progress</small>
            </div>
          </div>
        </div>
        <p>
          Anyone can read published material. An account is for enrolling,
          submitting work, recording progress, and writing a course of your own.
          That split keeps the front door open without pretending that private
          progress or a submission can be anonymous.
        </p>
      </section>

      <section class="about-section" aria-labelledby="different-title">
        <div class="section-heading">
          <p class="section-index">02 / what is distinctive</p>
          <h2 id="different-title">The useful constraints are visible.</h2>
        </div>
        <div class="value-grid">
          <article class="value-panel">
            <span class="panel-number">01</span>
            <h3>Courses that argue, rather than list</h3>
            <p>
              A lesson here is written to make a case for something, the way its
              author would explain it to somebody in the room, not a bullet list
              of facts to memorise.
            </p>
          </article>
          <article class="value-panel">
            <span class="panel-number">02</span>
            <h3>Marking that has to cite your own words back to you</h3>
            <p>
              A written answer with a rubric is marked by a language model
              against criteria the author wrote. It is not trusted on its own:
              every point it claims has to be backed by a quotation from what
              you actually wrote, and that quotation is checked in code before
              any mark is kept.
            </p>
          </article>
          <article class="value-panel">
            <span class="panel-number">03</span>
            <h3>Four kinds of work, not one kind of learner</h3>
            <p>
              Authors can ask for multiple choice, a written response, a project
              submission, or runnable code. A course can mix those shapes
              instead of forcing every subject into a programming exercise.
            </p>
          </article>
          <article class="value-panel">
            <span class="panel-number">04</span>
            <h3>Seven courses, written or ported for this platform</h3>
            <p>
              Four language courses (TypeScript, Go, C++, Rust) ported in from
              earlier tutorials, plus Tech Literacy, Programming Concepts, and
              Systems Design, written for this workspace.
            </p>
          </article>
        </div>
      </section>

      <section class="about-section" aria-labelledby="honesty-title">
        <div class="section-heading">
          <p class="section-index">03 / operating limits</p>
          <h2 id="honesty-title">What it does not do yet</h2>
        </div>
        <p class="honesty">
          The honesty is the point, so here is what to expect and what not to.
        </p>
        <ul class="limits">
          <li>
            Multiple choice is graded by a fixed rule, not a model, so it is
            exact. A written answer with a rubric is graded asynchronously by a
            model with an evidence check; a missing rubric or an unavailable
            marker leaves the attempt recorded for a person rather than lost.
          </li>
          <li>
            A project submission is recorded with the artifact types the author
            requested and is left for a person to mark. A code challenge runs in
            a sandbox, and only a passing verifier result awards its points.
          </li>
          <li>
            An answer that is genuinely wrong scores zero, the same as an answer
            the marker could not verify. The two are recorded differently on the
            server, but a learner sees the same outcome: no marks, and feedback
            saying why.
          </li>
          <li>
            Installing the app gets you a home-screen icon and keeps lessons you
            have already read available without a connection. It does not let
            you take a course offline you have not opened yet, and it does not
            let you submit work while offline.
          </li>
          <li>
            Publishing a course is the owner&rsquo;s decision alone. Co-editors
            can write and revise everything in it, but only the owner can put it
            in front of learners or take it down.
          </li>
        </ul>
      </section>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .about {
        width: min(100%, 76rem);
        margin: 0 auto;
        padding: 1rem 0 3.5rem;
      }
      .lede {
        max-width: 70ch;
        margin-bottom: 3rem;
      }
      .eyebrow,
      .section-index,
      .panel-number {
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
        max-width: 18ch;
        margin: 0.6rem 0 1rem;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 1.02;
        letter-spacing: -0.045em;
      }
      .dek {
        max-width: 62ch;
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 1.08rem;
        line-height: 1.7;
      }
      .about-section {
        max-width: 76ch;
        scroll-margin-top: 1.5rem;
      }
      .about-section + .about-section {
        margin-top: 4rem;
        padding-top: 3rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .section-heading {
        margin-bottom: 1.35rem;
      }
      .section-heading h2 {
        max-width: 28ch;
        margin: 0.35rem 0 0;
        font-size: clamp(1.6rem, 3vw, 2.25rem);
        line-height: 1.08;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0;
        color: var(--lx-text-body);
        line-height: 1.7;
      }
      .architecture-panel,
      .value-panel {
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .architecture-panel {
        margin-bottom: 1.5rem;
        padding: 1rem;
      }
      .architecture-flow {
        display: flex;
        align-items: stretch;
        gap: 0.55rem;
      }
      .architecture-node {
        display: grid;
        flex: 1 1 0;
        gap: 0.35rem;
        min-width: 0;
        padding: 0.9rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-border);
        border-radius: var(--lx-radius);
        background: var(--lx-well);
        box-shadow: var(--lx-shadow-inset);
      }
      .architecture-node strong {
        color: var(--lx-text);
        font: var(--lx-btn-weight, 800) 0.78rem var(--lx-font-mono, monospace);
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .architecture-node small {
        color: var(--lx-text-muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }
      .node-mark,
      .flow-arrow {
        color: var(--lx-accent);
        font: 700 0.68rem var(--lx-font-mono, monospace);
      }
      .flow-arrow {
        align-self: center;
        flex: 0 0 auto;
        font-size: 1.1rem;
      }
      .value-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }
      .value-panel {
        display: grid;
        align-content: start;
        gap: 0.55rem;
        padding: 1.1rem;
      }
      .value-panel h3 {
        margin: 0;
        color: var(--lx-text);
        font-size: 1rem;
        line-height: 1.3;
      }
      .value-panel p {
        color: var(--lx-text-muted);
        font-size: 0.9rem;
      }
      .honesty {
        max-width: 60ch;
        margin-bottom: 1.2rem;
        color: var(--lx-text-muted);
      }
      .limits {
        display: grid;
        gap: 0.95rem;
        max-width: 70ch;
        margin: 0;
        padding-left: 1.2rem;
        color: var(--lx-text-muted);
        line-height: 1.65;
      }
      .limits li::marker {
        color: var(--lx-accent);
      }
      @media (max-width: 680px) {
        .value-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .architecture-flow {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }
        .flow-arrow {
          justify-self: center;
          transform: rotate(90deg);
        }
      }
    `,
  ],
})
export class AboutContentComponent {}
