# Getting Started Guide Generator

This tool generates static HTML getting-started guides for three audiences:

- admins
- developers
- end users

## Source Content

The generator reads Markdown files with YAML front matter from:

```text
docs/getting-started-src/
```

Each audience has its own directory. One page per audience must declare `landing: true`. Non-landing pages should include:

- `id`
- `title`
- `slug`

Optional fields include:

- `summary`
- `parent`
- `order`
- `hero_eyebrow`
- `hero_lead`
- `quick_links`
- `featured`
- `next_steps`

## Usage

From the repository root:

```bash
go run ./tools/getting-started-guide/cmd/getting-started-guide \
  --source docs/getting-started-src \
  --output dist/getting-started-guides
```

## Output

The tool writes one static guide site per audience plus a shared stylesheet. By default that output lands in:

```text
dist/getting-started-guides/
```
