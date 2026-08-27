# What Let's Go is

Let's Go is a console for learning: lessons on one side, an editor and a compiler on
the other. It is dark and high-contrast the way a terminal is, in both its dark and
its light theme, because the light theme is not a different mood, it is the same
console with the sun up. The `architect` personality (raw, structural, monospace,
hard-edged) drives it, and that is not an accident of whoever wired up theming last:
it is the correct fit for a product whose whole argument is "here is exactly what
this does, try it."

Say plainly what it is not. It is not four tutorial sites in a trenchcoat: letsgots,
letsgogo, letsgocpp and letsgorust each had their own look, and none of those looks
survive as a per-language skin here. There is one product now, and every course
(TypeScript, Go, C++, Rust, or something with no compiler at all) gets the same
surface. It is also not a warm editorial reading site. The old products leaned amber
grounds and Playfair Display, which reads as "settle in with a magazine." Let's Go
wants you to open the editor. Warmth and serif type argue against that, so they are
gone, not merely unused.

# The palette

`apps/learning/src/learning-theme.scss` is the only place these are declared. Every
token exists in both the dark default and the light override, and the two
`[data-theme]` blocks are ordered after the `prefers-color-scheme` block on purpose,
so a manual toggle always beats the OS setting in either direction. Nothing here
should ever be redeclared in a component; a component that needs a colour reaches
for one of these.

**Surfaces, darkest to lightest.** `--lx-bg` (`#07101a` dark / `#f2f6f8` light) is the
page ground. `--lx-surface` (`#091622` / `#ffffff`) is a card or panel sitting on
that ground. `--lx-surface-hover` and `--lx-surface-active` are the same surface one
and two steps brighter, for hover and pressed/selected states, not for panels that
are merely nested; nesting should still read as `--lx-surface` with a border, or the
console starts looking like a staircase. `--lx-code`, `--lx-code-text` and
`--lx-well` are the code surface, and they are the one place the two themes
deliberately do not diverge in tone: code stays a dark well even in light mode,
because a pale code block next to a bright editor reads as broken, not as themed.
`--lx-inline-code` is the small background behind an inline `` `code` `` span in
prose, distinct from the block-level `--lx-code`.

**Rules.** `--lx-border` is the default divider or outline. `--lx-border-soft` is for
a division that should barely register (the line under the topbar). `--lx-border-strong`
is for something that needs to hold its own against a busy surface (a code block's
frame). `--lx-border-accent` is reserved for the left rule on a highlighted code
block, echoing the accent without being the accent itself.

**Type, brightest to dimmest.** `--lx-text` is a heading or anything that must read
first. `--lx-text-body` is prose. `--lx-text-muted`, `--lx-text-subtle` and
`--lx-text-faint` step down from there for captions, metadata, and things that
should recede, like Monaco's line numbers. Reach for the dimmest token that is still
comfortably legible for the job; using `--lx-text` everywhere flattens the hierarchy
that these five steps exist to create.

**Accent and status.** `--lx-accent` is a link, a primary button, a focus ring, an
active nav item: the one colour that means "this is the interactive thing." In dark
mode it is adopted straight from the personality's primary (`var(--primary,
#76e3d0)`), because it measures 12.45:1 against `--lx-bg` and a personality change
should be able to reach the app. In light mode it is held locally at `#0d7a66`
instead, because the personality's primary measures 1.54:1 on white and 1.41:1 on
the light `--lx-bg`, so it would fail outright; `#0d7a66` measures 4.84:1 on that
same ground, which clears AA for body text but not AAA, so do not use it for
anything smaller than the sizes it is used at now. Every other trait of the
personality still applies, only the accent colour is pinned. `--lx-accent-soft` is the accent turned down for
something like inline-code text that sits on a coloured chip rather than bare
ground. `--lx-danger` and `--lx-warn` are adopted from the personality the same way
the dark accent is, and exist for exactly what their names say: an error state, a
caution.

**Syntax tokens.** `--lx-syn-*` (comment, punct, keyword, string, number, function,
operator, property) are tuned specifically against `--lx-code`, not against the page
ground, and they do not change between themes, because the code well itself does
not change between themes. Both Monaco and the Prism highlighting in
`lesson-prose.component.ts` read from these, so a compiled snippet in a lesson and a
snippet in the live editor use the same seven colours.

**Typography and shape tokens.** `--lx-font-heading` and `--lx-font-mono` are not
literals, they are adapters onto the personality: heading resolves through
`var(--font-heading, var(--personality-font-family, inherit))`, mono through
`var(--font-mono, ui-monospace, monospace)`. Under `architect` that currently means
Oswald for headings and IBM Plex Mono everywhere else (`--personality-font-family`
carries the personality's body font, which for `architect` is also monospace).
`--lx-radius` adopts `--personality-border-radius`, and `--lx-focus` is simply
`var(--lx-accent)`, because a focus ring that disagreed with the accent colour would
be deciding contrast twice and could get it wrong once.

# The rules for a new component

Never hardcode a colour. If a `--lx-*` token exists for the job, use it; if the job
is genuinely new (a state none of the above covers), add the token to
`learning-theme.scss` in all applicable blocks before using it anywhere, with a
comment explaining what it is for, the same way every existing token is documented
above. Do not invent a token name and assume it is declared somewhere: this file has
previously shipped components that referenced `--lx-ground`, `--lx-rule`,
`--lx-text-dim` and `--lx-surface-2`, none of which existed, so those components
silently fell back to their own hardcoded hex and stopped following the theme the
moment anyone touched the palette. Before using any `var(--lx-something)`, check
that `something` is actually declared in `learning-theme.scss`. A token used in only
one theme block is a bug, not a shortcut; the audit for this slice confirmed the
file currently has none, keep it that way.

Both themes or it is not done. If you add or change a token, add it to `:root`, to
the `prefers-color-scheme: light` block, and to both `[data-theme]` overrides,
unless the token is genuinely theme-invariant like the syntax colours or the font
and radius tokens, in which case say so in a comment the way the existing ones do.
Test a component by actually toggling the theme, not by reading the dark values and
assuming light inherits them.

Angular components here use inline `styles:` arrays, not separate `.scss` files.
Keep that pattern; it keeps a component's markup, logic and look in one file, which
matters more in a library meant to be copied into other apps than it would in a
one-off page.

# What was inherited, and what was dropped

Adopted from the `architect` personality: the dark-mode accent, danger, warning,
both typefaces, the corner radius, and the focus ring. These are the traits that
make the console feel designed rather than merely dark, and they update
automatically if the personality system's definition of `architect` changes.

Held locally, on purpose: the entire surface ramp (background through
`--lx-border-accent`), because this app is a dark console in both themes and no
personality strategy currently expresses "stay dark in light mode too," and the
light-mode accent, because the personality's own primary is not legible on a white
ground.

Dropped, deliberately, not by oversight: the warm amber grounds and Playfair
Display of the four source products, and any per-language branding (a Rust course
does not get a different accent than a Go course). If you find yourself reaching
for a serif display face or a warm cream background because "the old letsgo sites
had it," that is the thing this document exists to stop. The four products are
gone. Let's Go is the one console that replaced them, and it should look like it
knows that.
