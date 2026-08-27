import { Component } from '@angular/core';

/**
 * What Let's Go is, honestly.
 *
 * Presentational and static: there is nothing here that needs a signal or a
 * request, only an argument for the platform and a plain account of what it
 * does not do yet. The claims are drawn from the code that backs them
 * (grading.ts, app.service.ts, typeorm.repository.ts, install.service.ts), not
 * from what would be nice to say.
 */
@Component({
  selector: 'otlearn-about-content',
  template: `
    <article class="about">
      <section class="lede">
        <p class="eyebrow">About</p>
        <h1>A course is an argument, not a shelf of notes.</h1>
        <p class="dek">
          Let&rsquo;s Go is a place to read a course somebody wrote, do the work
          it sets, and have that work marked against what the author was
          actually asking for. It is not a video library and it is not a wiki:
          every course here has an author who made choices about what matters
          and why.
        </p>
      </section>

      <section>
        <h2>Who it is for</h2>
        <p>
          Anyone who wants to learn something and anyone who has something to
          teach. Reading is open to everyone signed out. An account is only for
          two things: keeping your progress, and writing a course of your own.
        </p>
      </section>

      <section>
        <h2>What makes it different</h2>
        <ul class="props">
          <li>
            <h3>Courses that argue, rather than list</h3>
            <p>
              A lesson here is written to make a case for something, the way its
              author would explain it to somebody in the room, not a bullet list
              of facts to memorise.
            </p>
          </li>
          <li>
            <h3>Marking that has to cite your own words back to you</h3>
            <p>
              A written answer is marked by a language model against a rubric
              the author wrote. It is not trusted on its own: every point it
              claims has to be backed by a quotation from what you actually
              wrote, and that quotation is checked in code before any mark is
              kept. A criterion the marker cannot point at in your own words
              scores zero, whatever the model claimed.
            </p>
          </li>
          <li>
            <h3>Seven courses, written or ported for this platform</h3>
            <p>
              Four language courses (TypeScript, Go, C++, Rust) ported in from
              earlier tutorials, plus Tech Literacy, Programming Concepts and
              Systems Design, written for this workspace.
            </p>
          </li>
        </ul>
      </section>

      <section>
        <h2>What it does not do yet</h2>
        <p class="honesty">
          The honesty is the point, so here is what to expect and what not to.
        </p>
        <ul class="limits">
          <li>
            Multiple choice is graded by a fixed rule, not a model, so it is
            exact. A written answer is graded by a model, and the model can be
            slow, unreachable, or occasionally unable to produce something
            usable. When that happens the attempt is not scored: it is kept for
            a person to look at, rather than lost or marked wrong.
          </li>
          <li>
            An answer that is genuinely wrong scores zero, the same as an answer
            the marker could not verify. The two are recorded differently on the
            server, but a learner sees the same outcome either way: no marks,
            and feedback saying why.
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
        max-width: 62ch;
        margin: 0 auto;
        padding: 1rem 0 3rem;
      }
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.6rem 0 1rem;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.9rem, 4vw, 2.8rem);
        line-height: 1.1;
        letter-spacing: -0.03em;
      }
      .dek {
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 1.05rem;
        line-height: 1.65;
      }
      section {
        margin-top: 2.75rem;
        padding-top: 2rem;
        border-top: 1px solid var(--lx-border);
      }
      .lede {
        border-top: 0;
        padding-top: 0;
        margin-top: 0;
      }
      h2 {
        margin: 0 0 0.9rem;
        font-family: var(--lx-font-heading);
        font-size: 1.4rem;
        letter-spacing: -0.02em;
      }
      p {
        line-height: 1.65;
        color: var(--lx-text-body);
      }
      .honesty {
        color: var(--lx-text-muted);
      }
      .props {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1.5rem;
      }
      .props h3 {
        margin: 0 0 0.4rem;
        font-size: 1rem;
        font-weight: 700;
      }
      .props p {
        margin: 0;
        color: var(--lx-text-muted);
      }
      .limits {
        margin: 0;
        padding-left: 1.2rem;
        display: grid;
        gap: 0.9rem;
        color: var(--lx-text-muted);
        line-height: 1.6;
      }
      .limits li::marker {
        color: var(--lx-accent);
      }
    `,
  ],
})
export class AboutContentComponent {}
