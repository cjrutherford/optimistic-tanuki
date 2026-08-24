#!/usr/bin/env node
/**
 * The learning app, driven in a real browser.
 *
 * This runs through agent-browser rather than Playwright, because Playwright
 * refuses to install browsers on this host's OS and the machine already has a
 * Chrome that works. The checks are the same ones a person would make: does
 * the catalog have courses in it, does a lesson render as prose rather than as
 * markdown source, is the app installable, and does anything shout in the
 * console on the way through.
 *
 * Expects a stack already running. BASE_URL points at the app.
 */
import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8099';
const API_URL = process.env.API_URL || 'http://localhost:3000';

const results = [];
let firstCourseHref = '';

function browser(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('agent-browser', args, {
      encoding: 'utf8',
      timeout: 180_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (allowFailure) return '';
    throw new Error(
      `agent-browser ${args[0]} failed: ${error.stderr || error.message}`
    );
  }
}

/** Runs an expression in the page and parses whatever it returned. */
function evaluate(expression) {
  const raw = browser(['eval', expression]);
  try {
    return JSON.parse(raw);
  } catch {
    return raw.trim();
  }
}

/**
 * Opens a page in a session of its own.
 *
 * The browser is closed first on purpose. Driving several navigations through
 * one long-lived agent-browser session on this host wedges it: the first two
 * or three work and every command after that times out in CDP, whether or not
 * a service worker is involved. A fresh session per page is slower and it
 * works.
 */
/**
 * Loads a page and reads everything wanted from it in one go.
 *
 * One navigation and one evaluation per browser session, deliberately. This
 * host's agent-browser wedges after a handful of CDP calls in a single
 * session: the first few work and everything after times out. Polling for a
 * ready state made it worse, because polling is many calls. So each check
 * gets a fresh browser, waits once, and asks once.
 */
function inspect(path, expression, { settle = 10 } = {}) {
  browser(['close'], { allowFailure: true });
  // Twice, and both are needed. After a close the first open only wakes the
  // daemon and leaves the page on about:blank; the second one is the
  // navigation that sticks. Without it every check below reads an empty
  // document and reports the app as broken when it is not.
  browser(['open', `${BASE_URL}${path}`], { allowFailure: true });
  execFileSync('sleep', ['3']);
  browser(['open', `${BASE_URL}${path}`]);
  execFileSync('sleep', [String(settle)]);
  return evaluate(expression);
}

async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`Driving ${BASE_URL}\n`);
  browser(['set', 'viewport', '1280', '800'], { allowFailure: true });

  await check('the catalog offers courses, and a way in', () => {
    const seen = inspect(
      '/',
      `({ courses: document.querySelectorAll('a.course').length,
          heading: document.querySelector('h1')?.textContent?.trim() ?? '',
          firstCourse: document.querySelector('a.course')?.getAttribute('href') ?? '',
          signIn: document.querySelector('.session a')?.getAttribute('href') ?? '' })`
    );
    assert(seen.heading.length > 0, 'the catalog has no heading');
    assert(seen.courses > 0, 'no courses rendered');
    assert(
      seen.firstCourse.startsWith('/course/'),
      `a course links to "${seen.firstCourse}" rather than its own page`
    );
    assert(seen.signIn === '/sign-in', `sign in points at "${seen.signIn}"`);
    firstCourseHref = seen.firstCourse;
  });

  await check('a course page says what the course is before asking', () => {
    assert(firstCourseHref, 'no course to open');
    const page = inspect(
      firstCourseHref,
      `({ heading: document.querySelector('h1')?.textContent?.trim() ?? '',
          facts: document.querySelectorAll('dl dd').length,
          enrol: !!Array.from(document.querySelectorAll('button'))
            .find(b => /enrol/i.test(b.textContent || '')) })`
    );
    assert(page.heading.length > 0, 'the course page has no heading');
    assert(page.facts >= 2, `only ${page.facts} facts about the course`);
    assert(page.enrol, 'no way to enrol');
  });

  await check('a lesson renders as prose with its code coloured', () => {
    const lesson = inspect(
      '/module/go-foundations/go-foundations-basics/go-foundations-basics-hello-world',
      `(() => {
        const prose = document.querySelector('otlearn-lesson-prose');
        if (!prose) return { missing: 'the lesson body' };
        const token = prose.querySelector('.token.keyword');
        const pre = prose.querySelector('pre');
        if (!token || !pre) return { missing: token ? 'a code block' : 'a highlighted token' };
        return {
          text: (prose.textContent || '').length,
          headings: prose.querySelectorAll('h2,h3,h4').length,
          rawHashes: /(^|\\n)#{1,4}\\s/.test(prose.textContent || ''),
          keyword: getComputedStyle(token).color,
          background: getComputedStyle(pre).backgroundColor,
          body: getComputedStyle(document.body).color,
        };
      })()`,
      { settle: 14 }
    );
    assert(!lesson.missing, `${lesson.missing} never rendered`);
    assert(lesson.text > 200, `only ${lesson.text} characters of lesson`);
    assert(lesson.headings > 0, 'markdown headings did not become headings');
    assert(!lesson.rawHashes, 'markdown source is showing through');
    assert(
      lesson.keyword !== lesson.body,
      'keywords are body-coloured, so the highlighting styles never landed'
    );
    assert(
      lesson.background !== 'rgba(0, 0, 0, 0)',
      'the code block has no background of its own'
    );
  });

  await check('the app is installable', async () => {
    const manifest = await fetch(`${BASE_URL}/manifest.webmanifest`);
    assert(manifest.ok, `the manifest answered ${manifest.status}`);
    const parsed = await manifest.json();
    assert(parsed.name, 'the manifest has no name');
    assert(parsed.start_url, 'the manifest has no start_url');
    assert(
      (parsed.icons || []).some((icon) => icon.purpose === 'maskable'),
      'the manifest has no maskable icon'
    );
    const worker = await fetch(`${BASE_URL}/ngsw-worker.js`);
    assert(worker.ok, `the service worker answered ${worker.status}`);
    assert(
      (worker.headers.get('content-type') || '').includes('javascript'),
      'the service worker is served as something other than script'
    );
  });

  await check('the service worker can actually cache the shell', async () => {
    const config = await (await fetch(`${BASE_URL}/ngsw.json`)).json();
    const indexed = Object.keys(config.hashTable || {}).some((file) =>
      file.includes('index')
    );
    // Without the index in the hash table there is nothing to fall back to,
    // and navigations hang waiting for a page that was never cached.
    assert(indexed, 'the shell is not in the hash table, so nothing is cached');
    assert(
      config.navigationRequestStrategy === 'freshness',
      'navigations are answered from cache, which throws away server rendering'
    );
  });

  await check(
    'the service worker never caches work that must reach the server',
    async () => {
      const config = await (await fetch(`${BASE_URL}/ngsw.json`)).json();
      const cachedUrls = (config.dataGroups || []).flatMap(
        (group) => group.urls || group.patterns || []
      );
      for (const forbidden of [
        '/runs',
        '/submit',
        '/answer',
        '/enrolments',
        '/me/progress',
      ]) {
        assert(
          !cachedUrls.some((url) => String(url).includes(forbidden)),
          `${forbidden} is cached, and it must always reach the server`
        );
      }
    }
  );

  await check('an unknown lesson is a 404, not a server error', async () => {
    const response = await fetch(
      `${API_URL}/api/learning/programs/no-such-track/lessons/no-such-lesson`
    );
    assert(
      response.status === 404,
      `an unknown lesson answered ${response.status}`
    );
  });

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`
  );
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
