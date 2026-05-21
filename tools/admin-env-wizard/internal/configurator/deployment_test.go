package configurator

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

func writeTempFile(t *testing.T, dir, name, contents string) string {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(contents), 0644); err != nil {
		t.Fatalf("write temp file %s: %v", path, err)
	}
	return path
}

func TestLoadDeploymentConfigWithSecrets(t *testing.T) {
	tmpDir := t.TempDir()
	deploymentPath := writeTempFile(t, tmpDir, "deployment.yaml", `
version: v1alpha1
environment:
  name: acme
  namespace: acme
  targets: [compose]
  composeMode: image
  provider: vultr
  imageOwner: cjrutherford
  defaultTag: latest
  infra: [postgres, redis]
  capabilities: [community]
  services: [gateway, authentication, client-interface, owner-console]
gateway:
  publicUrl: https://gateway.example.com
  publicWsUrl: wss://gateway.example.com
  internalUrl: http://gateway:3000
  internalWsUrl: http://gateway:3300
apps:
  - appId: client-interface
    domain: app.example.com
    uiBaseUrl: https://app.example.com
    apiBaseUrl: https://gateway.example.com/api
    appType: client
    visibility: public
    oauth:
      enabled: true
  - appId: owner-console
    domain: owner.example.com
    uiBaseUrl: https://owner.example.com
    apiBaseUrl: https://gateway.example.com/api
    appType: admin
    visibility: internal
oauth:
  enabled: true
  bridgeAppId: client-interface
  providers:
    google:
      enabled: true
      clientIdKey: GOOGLE_CLIENT_ID
      clientSecretKey: GOOGLE_CLIENT_SECRET
      redirectUri: https://gateway.example.com/api/oauth/callback/google
`)
	secretsPath := writeTempFile(t, tmpDir, "deployment.secrets.env", `
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
JWT_SECRET=test-jwt-secret
POSTGRES_PASSWORD=test-postgres-password
REDIS_PASSWORD=
`)

	doc, secrets, err := LoadDeploymentConfig(deploymentPath, secretsPath)
	if err != nil {
		t.Fatalf("LoadDeploymentConfig() error = %v", err)
	}

	if doc.Environment.Name != "acme" {
		t.Fatalf("expected environment name acme, got %q", doc.Environment.Name)
	}
	if got := secrets["GOOGLE_CLIENT_ID"]; got != "test-google-client-id" {
		t.Fatalf("expected GOOGLE_CLIENT_ID secret, got %q", got)
	}
	if _, exists := secrets["REDIS_PASSWORD"]; !exists {
		t.Fatal("expected blank optional secrets to remain addressable")
	}
}

func TestGenerateDeploymentArtifactsWritesEnvRegistryAndValidationReport(t *testing.T) {
	tmpDir := t.TempDir()
	deploymentPath := writeTempFile(t, tmpDir, "deployment.yaml", `
version: v1alpha1
environment:
  name: acme
  namespace: acme
  targets: [compose, k8s]
  composeMode: image
  provider: vultr
  imageOwner: cjrutherford
  defaultTag: latest
  infra: [postgres, redis]
  capabilities: [community]
  services: [gateway, authentication, profile, social, permissions, client-interface, owner-console, video-client]
gateway:
  publicUrl: https://gateway.example.com
  publicWsUrl: wss://gateway.example.com
  internalUrl: http://gateway:3000
  internalWsUrl: http://gateway:3300
urlPrefixes:
  - id: base-domain
    label: Base Domain
    prefix: https://example.com
  - id: gateway-api
    label: Gateway API
    prefix: https://gateway.example.com
apps:
  - appId: client-interface
    domain: example.com
    subdomain: app
    uiBaseUrlPrefixId: base-domain
    apiBaseUrlPrefixId: gateway-api
    apiBaseUrlSuffix: /api
    appType: client
    visibility: public
    oauth:
      enabled: true
  - appId: owner-console
    domain: owner.example.com
    uiBaseUrl: https://owner.example.com
    apiBaseUrl: https://gateway.example.com/api
    appType: admin
    visibility: internal
  - appId: video-client
    domain: video.example.com
    uiBaseUrl: https://video.example.com
    apiBaseUrl: https://gateway.example.com/api
    appType: client
    visibility: public
oauth:
  enabled: true
  bridgeAppId: client-interface
  providers:
    google:
      enabled: true
      clientIdKey: GOOGLE_CLIENT_ID
      clientSecretKey: GOOGLE_CLIENT_SECRET
      redirectUri: https://gateway.example.com/api/oauth/callback/google
`)
	secretsPath := writeTempFile(t, tmpDir, "deployment.secrets.env", `
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
JWT_SECRET=test-jwt-secret
POSTGRES_PASSWORD=test-postgres-password
POSTGRES_USER=postgres
POSTGRES_DB=postgres
REDIS_PASSWORD=
PRODUCTION_IMAGE_TAG=latest
`)

	doc, secrets, err := LoadDeploymentConfig(deploymentPath, secretsPath)
	if err != nil {
		t.Fatalf("LoadDeploymentConfig() error = %v", err)
	}

	outputDir := filepath.Join(tmpDir, "out")
	result, err := GenerateDeploymentArtifacts(
		doc,
		secrets,
		catalog.DefaultCatalog(),
		output.NewWriter(outputDir),
	)
	if err != nil {
		t.Fatalf("GenerateDeploymentArtifacts() error = %v", err)
	}

	if result.RegistryPath == "" {
		t.Fatal("expected generated registry path")
	}
	if result.RuntimeEnvPath == "" {
		t.Fatal("expected generated runtime env path")
	}
	if result.ValidationReportPath == "" {
		t.Fatal("expected validation report path")
	}

	registryBytes, err := os.ReadFile(filepath.Join(outputDir, result.RegistryPath))
	if err != nil {
		t.Fatalf("read generated registry: %v", err)
	}
	registryText := string(registryBytes)
	if !strings.Contains(registryText, `"appId": "client-interface"`) {
		t.Fatalf("expected client-interface in generated registry, got %s", registryText)
	}
	if !strings.Contains(registryText, `"uiBaseUrl": "https://app.example.com"`) {
		t.Fatalf("expected resolved prefixed uiBaseUrl in generated registry, got %s", registryText)
	}
	if !strings.Contains(registryText, `"appId": "owner-console"`) {
		t.Fatalf("expected owner-console in generated registry, got %s", registryText)
	}

	envBytes, err := os.ReadFile(filepath.Join(outputDir, result.RuntimeEnvPath))
	if err != nil {
		t.Fatalf("read generated runtime env: %v", err)
	}
	envText := string(envBytes)
	if !strings.Contains(envText, "CLIENT_INTERFACE_DOMAIN=app.example.com") {
		t.Fatalf("expected client-interface domain in runtime env, got %s", envText)
	}
	if !strings.Contains(envText, "CLIENT_INTERFACE_UI_BASE_URL=https://app.example.com") {
		t.Fatalf("expected resolved client-interface base URL in runtime env, got %s", envText)
	}
	if strings.Contains(envText, "REDIS_PASSWORD=\n") {
		t.Fatalf("expected blank optional values to be omitted from runtime env, got %s", envText)
	}
	if !strings.Contains(envText, "GOOGLE_CLIENT_ID=test-google-client-id") {
		t.Fatalf("expected OAuth secret material in runtime env, got %s", envText)
	}
}

func TestSaveDeploymentConfigRoundTripsURLPrefixes(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "deployment.yaml")
	doc := &DeploymentConfig{
		Version: "v1alpha1",
		Environment: DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		URLPrefixes: []DeploymentURLPrefix{
			{ID: "base-domain", Label: "Base Domain", Prefix: "https://example.com"},
		},
		Apps: []DeploymentApp{
			{
				AppID:             "client-interface",
				Domain:            "example.com",
				Subdomain:         "app",
				UIBaseURLPrefixID: "base-domain",
				APIBaseURL:        "https://gateway.example.com/api",
				AppType:           "client",
				Visibility:        "public",
			},
		},
	}

	if err := SaveDeploymentConfig(path, doc); err != nil {
		t.Fatalf("SaveDeploymentConfig() error = %v", err)
	}

	loaded, _, err := LoadDeploymentConfig(path, "")
	if err != nil {
		t.Fatalf("LoadDeploymentConfig() error = %v", err)
	}

	if len(loaded.URLPrefixes) != 1 {
		t.Fatalf("expected one url prefix, got %d", len(loaded.URLPrefixes))
	}
	if loaded.Apps[0].UIBaseURLPrefixID != "base-domain" {
		t.Fatalf("expected prefix id to round trip, got %q", loaded.Apps[0].UIBaseURLPrefixID)
	}
	if got := resolveAppUIBaseURL(loaded, loaded.Apps[0]); got != "https://app.example.com" {
		t.Fatalf("expected resolved prefixed UI url, got %q", got)
	}
}

func TestResolveAppUIBaseURLUsesSubdomainAndDomainWhenSuffixBlank(t *testing.T) {
	doc := &DeploymentConfig{
		URLPrefixes: []DeploymentURLPrefix{
			{ID: "base-domain", Prefix: "https://example.com"},
		},
	}
	app := DeploymentApp{
		Domain:            "fallback.example.com",
		Subdomain:         "beta.owner",
		UIBaseURLPrefixID: "base-domain",
	}

	if got := resolveAppUIBaseURL(doc, app); got != "https://beta.owner.example.com" {
		t.Fatalf("expected subdomain-expanded URL, got %q", got)
	}
}

func TestResolveAppUIBaseURLFallsBackToDomainAndSubdomainWhenNoPrefixOrManualURL(t *testing.T) {
	app := DeploymentApp{
		Domain:    "example.com",
		Subdomain: "client",
	}

	if got := ResolveDeploymentAppUIBaseURL(nil, app); got != "https://client.example.com" {
		t.Fatalf("expected domain/subdomain derived URL, got %q", got)
	}
}

func TestResolveAppAPIBaseURLDefaultsToResolvedUIBaseURL(t *testing.T) {
	doc := &DeploymentConfig{
		URLPrefixes: []DeploymentURLPrefix{
			{ID: "base-domain", Prefix: "https://example.com"},
		},
	}
	app := DeploymentApp{
		Domain:            "example.com",
		Subdomain:         "client",
		UIBaseURLPrefixID: "base-domain",
	}

	if got := ResolveDeploymentAppAPIBaseURL(doc, app); got != "https://client.example.com/api" {
		t.Fatalf("expected API URL to derive from resolved UI URL, got %q", got)
	}
}

func TestValidateDeploymentArtifactsRequiresOAuthBridgeApp(t *testing.T) {
	doc := &DeploymentConfig{
		Version: "v1alpha1",
		Environment: DeploymentEnvironment{
			Name:        "broken",
			Namespace:   "broken",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "owner-console"},
		},
		Gateway: DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		Apps: []DeploymentApp{
			{
				AppID:      "owner-console",
				Domain:     "owner.example.com",
				UIBaseURL:  "https://owner.example.com",
				APIBaseURL: "https://gateway.example.com/api",
				AppType:    "admin",
				Visibility: "internal",
			},
		},
		OAuth: DeploymentOAuth{
			Enabled:     true,
			BridgeAppID: "client-interface",
			Providers: map[string]DeploymentOAuthProvider{
				"google": {
					Enabled:         true,
					ClientIDKey:     "GOOGLE_CLIENT_ID",
					ClientSecretKey: "GOOGLE_CLIENT_SECRET",
					RedirectURI:     "https://gateway.example.com/api/oauth/callback/google",
				},
			},
		},
	}

	issues := ValidateDeploymentArtifacts(doc, map[string]string{}, catalog.DefaultCatalog())
	if len(issues) == 0 {
		t.Fatal("expected validation issues")
	}

	foundBridgeError := false
	for _, issue := range issues {
		if strings.Contains(issue.Message, "bridge app") {
			foundBridgeError = true
			break
		}
	}
	if !foundBridgeError {
		t.Fatalf("expected OAuth bridge validation issue, got %+v", issues)
	}
}

func TestSaveDeploymentConfigRoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "deployment.yaml")

	doc := &DeploymentConfig{
		Version: "v1alpha1",
		Environment: DeploymentEnvironment{
			Name:        "roundtrip",
			Namespace:   "roundtrip",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		Apps: []DeploymentApp{
			{
				AppID:      "client-interface",
				Name:       "Client Interface",
				Domain:     "app.example.com",
				UIBaseURL:  "https://app.example.com",
				APIBaseURL: "https://gateway.example.com/api",
				AppType:    "client",
				Visibility: "public",
			},
		},
	}

	if err := SaveDeploymentConfig(path, doc); err != nil {
		t.Fatalf("SaveDeploymentConfig() error = %v", err)
	}

	loaded, _, err := LoadDeploymentConfig(path, "")
	if err != nil {
		t.Fatalf("LoadDeploymentConfig() error = %v", err)
	}

	if loaded.Environment.Name != "roundtrip" {
		t.Fatalf("expected roundtrip environment name, got %q", loaded.Environment.Name)
	}
	if len(loaded.Apps) != 1 || loaded.Apps[0].AppID != "client-interface" {
		t.Fatalf("expected saved app registry entry, got %+v", loaded.Apps)
	}
}

func TestSaveSecretsFileRoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "deployment.secrets.env")
	secrets := map[string]string{
		"JWT_SECRET":       "secret",
		"GOOGLE_CLIENT_ID": "client-id",
		"REDIS_PASSWORD":   "",
	}

	if err := SaveSecretsFile(path, secrets); err != nil {
		t.Fatalf("SaveSecretsFile() error = %v", err)
	}

	_, loaded, err := LoadDeploymentConfig(
		writeTempFile(t, tmpDir, "deployment.yaml", "version: v1alpha1\nenvironment:\n  name: demo\n"),
		path,
	)
	if err != nil {
		t.Fatalf("LoadDeploymentConfig() error = %v", err)
	}

	if loaded["JWT_SECRET"] != "secret" {
		t.Fatalf("expected JWT secret round-trip, got %q", loaded["JWT_SECRET"])
	}
	if value, ok := loaded["REDIS_PASSWORD"]; !ok || value != "" {
		t.Fatalf("expected blank secret round-trip, got %q present=%v", value, ok)
	}
}
