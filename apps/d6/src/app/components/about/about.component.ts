import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <div class="about-container">
      <h1 class="page-title">About Daily Reflections</h1>

      <div class="content-grid">
        <otui-card class="content-card">
          <h2>What's a Daily 6 or Daily 4?</h2>
          <p>
            A Daily 6 is a set of six tasks to complete each day, while a Daily 4
            is a shorter version with just four tasks. Both are designed to build
            a pattern of self-compassion, mindfulness, and emotional resilience.
            They exercise your ability to reflect on your day in a structured,
            non-judgemental, and supportive way.
          </p>
        </otui-card>

        <div class="image-card">
          <img src="assets/dbt-puzzle.png" alt="DBT Puzzle" />
        </div>

        <otui-card class="content-card">
          <h2>Where does the Daily Habit come from?</h2>
          <p>
            The Daily Six or Four prompts are derived from DBT techniques and are
            designed for those seeking to enhance their emotional awareness and
            resilience. By engaging with these prompts, individuals can cultivate
            a deeper understanding of their thoughts and feelings, ultimately
            leading to more effective coping strategies and a greater sense of
            well-being.
          </p>
        </otui-card>

        <div class="image-card">
          <img src="assets/wellbeing.png" alt="Wellbeing" />
        </div>

        <div class="image-card">
          <img src="assets/hardwork.png" alt="Hard Work" />
        </div>

        <otui-card class="content-card">
          <h2>What is DBT?</h2>
          <p>
            Dialectical Behavior Therapy (DBT) is a type of cognitive-behavioral
            therapy that focuses on teaching skills to help individuals manage
            their emotions, cope with stress, and improve their relationships. It
            was originally developed to treat borderline personality disorder but
            has since been adapted for use with a variety of mental health issues.
          </p>
        </otui-card>

        <div class="image-card">
          <img src="assets/dbt-puzzle.png" alt="DBT Puzzle" />
        </div>

        <otui-card class="content-card">
          <h2>Daily Six Prompts</h2>
          <ul>
            <li>
              <strong>Affirmation:</strong> Start with a positive affirmation or
              statement of something you feel you did well.
            </li>
            <li>
              <strong>Judgement:</strong> Reflect on something you judged
              yourself for today.
            </li>
            <li>
              <strong>Non-Judgement:</strong> Practice observing your thoughts in
              a non-judgemental way by reframing the judgement prompt.
            </li>
            <li>
              <strong>Planned Pleasurable:</strong> Identify something you plan
              to do today that will bring you joy or satisfaction.
            </li>
            <li>
              <strong>Mindfulness:</strong> Engage in a mindfulness exercise,
              such as focusing on a specific task, meditation, or being present
              in the moment.
            </li>
            <li>
              <strong>Gratitude:</strong> Write down something you are grateful
              for today.
            </li>
          </ul>
        </otui-card>

        <otui-card class="content-card">
          <h2>Daily Four Prompts</h2>
          <ul>
            <li>
              <strong>Affirmation:</strong> Start with a positive affirmation or
              statement of something you feel you did well.
            </li>
            <li>
              <strong>Planned Pleasurable:</strong> Identify something you plan
              to do today that will bring you joy or satisfaction.
            </li>
            <li>
              <strong>Mindfulness:</strong> Engage in a mindfulness exercise,
              such as focusing on a specific task, meditation, or being present
              in the moment.
            </li>
            <li>
              <strong>Gratitude:</strong> Write down something you are grateful
              for today.
            </li>
          </ul>
        </otui-card>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .about-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--spacing-lg, 24px);
    }

    .page-title {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: var(--spacing-xl, 32px);
      color: var(--foreground, #212121);
    }

    .content-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-lg, 24px);
    }

    @media (max-width: 768px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    .content-card {
      h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: var(--spacing-md, 16px);
        color: var(--foreground, #1a1a2e);
      }

      p {
        color: var(--muted, #6b7280);
        line-height: 1.7;
        margin: 0;
      }

      ul {
        margin: 0;
        padding-left: var(--spacing-lg, 24px);
      }

      li {
        margin-bottom: var(--spacing-sm, 8px);
        color: var(--foreground, #374151);
        line-height: 1.6;
      }

      strong {
        color: var(--primary, #4f46e5);
      }
    }

    .image-card {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--border-radius-lg, 12px);
      overflow: hidden;
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, #e5e7eb);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  `],
})
export class AboutComponent {}
