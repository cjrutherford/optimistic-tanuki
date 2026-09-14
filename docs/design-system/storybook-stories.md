# Writing Storybook stories

Every UI library has a Storybook built from the shared factories in
`tools/storybook/`. `apps/ui-playground` composes all of them, so a story added
to a library appears in both places. Run a library's Storybook with
`nx storybook <lib>` and the playground with `nx serve ui-playground`.

## Setting up a library

`libs/<lib>/.storybook/` holds three files:

```ts
// main.ts
import { createLibraryStorybookConfig } from '../../../tools/storybook/main';

export default createLibraryStorybookConfig('<Library Name>');
```

```ts
// preview.ts
import { createPreview } from '../../../tools/storybook/preview';

export default createPreview();
```

plus a `tsconfig.json` that includes `../src/**/*.stories.ts` and `*.ts`. Add the
`storybook`, `build-storybook` and `static-storybook` targets to `project.json`
(copy them from any library that has them), and add the library's stories glob
to `apps/ui-playground/.storybook/tsconfig.json`;
`apps/ui-playground/src/storybook-composition.spec.ts` fails until you do.

## Checklist for a story file

- **Title** is relative to the library: `title: 'Primitives/Badge'`, not
  `'Common UI/Primitives/Badge'`. The library name is added as the sidebar
  prefix.
- **`tags: ['autodocs']`** so the component gets a Docs page with its inputs.
- **Controls**: give every input a sensible `args` default, and `argTypes` with
  `options` for unions (tone, size, variant). Wire outputs with
  `{ action: 'name' }`.
- **States**: cover the states that change what renders: empty, loading,
  error, disabled, selected, long content. One story per state; don't bury
  them behind controls.
- **No colours or fonts in story markup**. Use theme tokens
  (`var(--surface)`, `var(--border)`), never hex values, so the story follows
  the Personality and Mode toolbars.
- **No personality branches**. Never check a personality id in a story or
  component; the toolbars exist to review every personality with the same
  story.
- **Fixtures**: keep sample data in a `*.fixtures.ts` file next to the
  component when more than one story uses it. Use `@storybook/test` for `play`
  functions.
- **Services**: components that inject services need providers. Add them with
  `applicationConfig({ providers: [...] })` in the story's `decorators`, using
  small in-story fakes rather than real HTTP.

Review a new story in both light and dark mode and at least three
personalities (for example foundation, control-center and playful) before
opening a pull request.
