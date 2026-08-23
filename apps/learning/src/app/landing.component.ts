import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'learning-landing',
  imports: [RouterLink],
  template: ` <main class="landing">
    <nav><span>Let&rsquo;s Go</span><a routerLink="/dashboard">Sign in</a></nav>
    <section>
      <p>Let&rsquo;s Go · TypeScript, Go, C++, Rust</p>
      <h1>Let&rsquo;s go.<br />One language at a time.</h1>
      <div class="code">
        fn main() &#123;<br />&nbsp;&nbsp;let next =
        <b>understand</b>();<br />&#125;
      </div>
      <p class="lede">
        Four tracks, one place. Read a short lesson, change code that runs, and
        find out immediately whether you were right.
      </p>
      <a class="start" routerLink="/dashboard">Start learning</a>
    </section>
  </main>`,
  styles: [
    `
      .landing {
        min-height: 100vh;
        padding: 1.4rem clamp(1.4rem, 6vw, 6rem);
        color: var(--lx-text);
        background: radial-gradient(
            circle at 78% 35%,
            var(--lx-surface-active) 0,
            transparent 28%
          ),
          var(--lx-bg);
      }
      .landing nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .landing nav span {
        color: var(--lx-accent);
        font-weight: 800;
      }
      .landing nav a {
        color: var(--lx-text-muted);
        text-decoration: none;
      }
      .landing section {
        max-width: 900px;
        margin: clamp(5rem, 16vh, 11rem) auto;
      }
      .landing section > p:first-child {
        color: var(--lx-accent);
        font: 700 0.72rem ui-monospace, monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .landing h1 {
        margin: 0.7rem 0 1.5rem;
        font-size: clamp(3.3rem, 8vw, 7.5rem);
        line-height: 0.88;
        letter-spacing: -0.075em;
      }
      .code {
        max-width: 420px;
        margin: 2rem 0;
        padding: 1.1rem 1.4rem;
        border-left: 2px solid var(--lx-accent);
        background: var(--lx-surface);
        color: var(--lx-text-muted);
        font: 400 0.95rem/1.7 ui-monospace, monospace;
      }
      .code b {
        color: var(--lx-warn);
      }
      .lede {
        max-width: 54ch;
        color: var(--lx-text-muted);
        line-height: 1.7;
        font-size: 1.08rem;
        margin-bottom: 1.7rem;
      }
      .start {
        display: inline-block;
        padding: 0.8rem 1.2rem;
        background: var(--lx-accent);
        color: var(--lx-bg);
        text-decoration: none;
        font-weight: 800;
      }
    `,
  ],
})
export class LandingComponent {}
