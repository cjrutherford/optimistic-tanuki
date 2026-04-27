package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunGeneratesGuideSite(t *testing.T) {
	sourceDir := filepath.Join("..", "..", "..", "..", "docs", "getting-started-src")
	outputDir := filepath.Join(t.TempDir(), "site")

	if err := run([]string{"--source", sourceDir, "--output", outputDir}); err != nil {
		t.Fatal(err)
	}

	indexPath := filepath.Join(outputDir, "admins", "index.html")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(string(data), "Admin Guide") {
		t.Fatalf("expected generated admin guide landing page, got:\n%s", string(data))
	}
}
