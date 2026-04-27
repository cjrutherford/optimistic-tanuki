package generator

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParsePageRendersMarkdownAndFrontMatter(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "intro.md")
	content := `---
id: intro
title: Intro
slug: intro
summary: Start here
order: 10
---
# Welcome

- Step one
- Step two
`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	page, err := parsePage(path, "developers")
	if err != nil {
		t.Fatal(err)
	}

	if page.Meta.ID != "intro" {
		t.Fatalf("expected intro id, got %q", page.Meta.ID)
	}
	if !strings.Contains(string(page.BodyHTML), "<h1>Welcome</h1>") {
		t.Fatalf("expected markdown heading HTML, got %s", page.BodyHTML)
	}
	if !strings.Contains(string(page.BodyHTML), "<li>Step one</li>") {
		t.Fatalf("expected markdown list HTML, got %s", page.BodyHTML)
	}
}

func TestLoadAudienceRejectsConflictingOutputPaths(t *testing.T) {
	dir := t.TempDir()
	audienceDir := filepath.Join(dir, "admins")
	if err := os.MkdirAll(audienceDir, 0o755); err != nil {
		t.Fatal(err)
	}

	writePage(t, filepath.Join(audienceDir, "landing.md"), `---
id: home
title: Admin Guide
landing: true
order: 1
---
# Admin Guide
`)
	writePage(t, filepath.Join(audienceDir, "setup.md"), `---
id: setup
title: Setup
slug: setup
order: 10
---
# Setup
`)
	writePage(t, filepath.Join(audienceDir, "setup-duplicate.md"), `---
id: setup-duplicate
title: Setup Again
slug: setup
order: 20
---
# Duplicate
`)

	_, err := loadAudience(audienceDir, "admins")
	if err == nil || !strings.Contains(err.Error(), "path conflict") {
		t.Fatalf("expected path conflict error, got %v", err)
	}
}

func TestGenerateBuildsLandingAndNestedPages(t *testing.T) {
	sourceDir := t.TempDir()
	outputDir := filepath.Join(t.TempDir(), "out")
	audienceDir := filepath.Join(sourceDir, "developers")
	if err := os.MkdirAll(audienceDir, 0o755); err != nil {
		t.Fatal(err)
	}

	writePage(t, filepath.Join(audienceDir, "landing.md"), `---
id: home
title: Developer Guide
landing: true
hero_eyebrow: Build with confidence
hero_lead: Start local development fast.
quick_links:
  - label: Install tooling
    page: prerequisites
featured:
  - title: Local stack
    page: local-stack
    body: Bring up the local platform.
next_steps:
  - label: Read workflows
    page: workflows
---
# Developer Guide

Use this guide to set up your environment.
`)
	writePage(t, filepath.Join(audienceDir, "prerequisites.md"), `---
id: prerequisites
title: Prerequisites
slug: prerequisites
order: 10
summary: Install required tools.
---
# Prerequisites

- Docker
- Node.js
`)
	writePage(t, filepath.Join(audienceDir, "local-stack.md"), `---
id: local-stack
title: Local Stack
slug: local-stack
order: 20
summary: Start the stack
---
# Local Stack

Run the development stack.
`)
	writePage(t, filepath.Join(audienceDir, "workflows.md"), `---
id: workflows
title: Daily Workflows
slug: workflows
order: 30
summary: Common development loops.
---
# Daily Workflows

Build, test, and inspect logs.
`)
	writePage(t, filepath.Join(audienceDir, "debugging.md"), `---
id: debugging
title: Debugging
slug: debugging
parent: workflows
order: 40
summary: Find common issues.
---
# Debugging

Look at logs and targeted tests.
`)

	if err := Generate(sourceDir, outputDir); err != nil {
		t.Fatal(err)
	}

	assertContains(t, filepath.Join(outputDir, "developers", "index.html"), "Developer Guide")
	assertContains(t, filepath.Join(outputDir, "developers", "index.html"), "Build with confidence")
	assertContains(t, filepath.Join(outputDir, "developers", "prerequisites", "index.html"), "Prerequisites")
	assertContains(t, filepath.Join(outputDir, "developers", "workflows", "debugging", "index.html"), "Debugging")
	assertContains(t, filepath.Join(outputDir, "site.css"), "--accent")
}

func writePage(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertContains(t *testing.T, path, snippet string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), snippet) {
		t.Fatalf("expected %q in %s, got:\n%s", snippet, path, string(data))
	}
}
