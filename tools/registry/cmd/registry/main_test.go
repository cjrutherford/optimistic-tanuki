package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateComputesSubdomainURL(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "apps.yaml")
	output := filepath.Join(dir, "registry.json")
	if err := os.WriteFile(input, []byte(`version: "1.0.0"
apps:
  - appId: store
    name: Store
    domain: haidev.com
    subdomain: store
    apiBaseUrl: https://api.haidev.com
    appType: client
    visibility: public
`), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := run([]string{"generate", "--input", input, "--output", output}); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	var generated outputRegistry
	if err := json.Unmarshal(data, &generated); err != nil {
		t.Fatal(err)
	}
	if generated.Apps[0].UIBaseURL != "https://store.haidev.com" {
		t.Fatalf("expected computed URL, got %s", generated.Apps[0].UIBaseURL)
	}
}

func TestValidateRejectsDuplicateAppIDs(t *testing.T) {
	err := validateConfig(registryConfig{
		Version: "1.0.0",
		Apps: []appConfig{
			{
				AppID:      "hai",
				Name:       "HAI",
				Domain:     "haidev.com",
				APIBaseURL: "https://api.haidev.com",
				AppType:    "client",
				Visibility: "public",
			},
			{
				AppID:      "hai",
				Name:       "HAI Duplicate",
				Domain:     "haidev.com",
				APIBaseURL: "https://api.haidev.com",
				AppType:    "client",
				Visibility: "public",
			},
		},
	})

	if err == nil || !strings.Contains(err.Error(), "duplicate appId") {
		t.Fatalf("expected duplicate appId error, got %v", err)
	}
}
