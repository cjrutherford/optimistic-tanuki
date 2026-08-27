---
title: Let's Go
summary: The learning platform client. Any subject, courses anyone can write, and code that runs on the server.
category: apps
section: applications
tags:
  - learning
  - courses
  - angular
  - pwa
---

# Let's Go

`learning` is the client for the learning platform. It is not a programming
tutorial site that happens to be extensible: it is a platform for teaching any
subject, which currently ships with four programming courses because those are
what existed to port.

Angular with SSR, installable as a PWA, and offline for lessons already read.

## What Somebody Does Here

A **learner** browses the catalog, opens a course, enrols, and works through
its lessons. Lessons carry exercises whose code is compiled and run on the
server, and activities the course author wrote, which are marked against the
author's rubric. Progress and points are recorded per lesson.

An **author** opts in, writes a course, sets work against its lessons, and
publishes when it is ready. A draft is visible to its owner and to the people
who answer for the platform, and to nobody else.

## Routes

| Path                                   | What it is                                                     |
| -------------------------------------- | -------------------------------------------------------------- |
| `/`                                    | The catalog, grouped by subject                                |
| `/course/:offeringId`                  | A course page: what it is, who wrote it, whether you are in it |
| `/module/:trackId/:moduleId`           | A module's lessons                                             |
| `/module/:trackId/:moduleId/:lessonId` | A lesson, its exercises and its activities                     |
| `/dashboard`                           | What you have enrolled in and how far you have got             |
| `/author`                              | Your courses, if you have opted in to authoring                |
| `/author/:offeringId`                  | The course editor                                              |
| `/sign-in`                             | Sign in                                                        |

## Key Files

- `apps/learning/src/app/app.routes.ts` — the routes above
- `apps/learning/src/app/catalog.component.ts` — the catalog
- `apps/learning/src/app/lesson.component.ts` — reading a lesson and doing its work
- `apps/learning/src/app/code-editor.component.ts` — the editor, with compiler errors on the right line
- `apps/learning/src/app/course-editor.component.ts` — authoring and publishing
- `apps/learning/ngsw-config.json` — what is cached for offline reading, and what must always reach the server

## What It Talks To

- `apps/gateway` for every request, which is where authorization lives
- `apps/learning-service` behind it, over TCP
- `apps/learning-runner` for compiling and running submitted code
- `libs/learning-domain` for the schemas both sides agree on
- `libs/learning-ui` for components shared with anything else that grows here

## Related

- `apps/learning-e2e` drives both journeys in a real browser
- `docs/learning-platform/` for the platform's design notes
