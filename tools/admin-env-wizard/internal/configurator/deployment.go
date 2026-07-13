package configurator

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
	"gopkg.in/yaml.v3"
)

type DeploymentConfig struct {
	Version     string                   `yaml:"version"`
	Environment DeploymentEnvironment    `yaml:"environment"`
	Databases   []DeploymentDatabaseSlot `yaml:"databases,omitempty"`
	Services    []DeploymentService      `yaml:"services,omitempty"`
	Gateway     DeploymentGateway        `yaml:"gateway"`
	URLPrefixes []DeploymentURLPrefix    `yaml:"urlPrefixes,omitempty"`
	Apps        []DeploymentApp          `yaml:"apps"`
	OAuth       DeploymentOAuth          `yaml:"oauth"`
}

type DeploymentEnvironment struct {
	Name         string   `yaml:"name"`
	Namespace    string   `yaml:"namespace"`
	Targets      []string `yaml:"targets"`
	ComposeMode  string   `yaml:"composeMode"`
	Provider     string   `yaml:"provider"`
	ImageOwner   string   `yaml:"imageOwner"`
	DefaultTag   string   `yaml:"defaultTag"`
	Infra        []string `yaml:"infra"`
	Capabilities []string `yaml:"capabilities"`
	Services     []string `yaml:"services"`
}

type DeploymentGateway struct {
	PublicURL     string `yaml:"publicUrl"`
	PublicWSURL   string `yaml:"publicWsUrl"`
	InternalURL   string `yaml:"internalUrl"`
	InternalWSURL string `yaml:"internalWsUrl"`
}

type DeploymentURLPrefix struct {
	ID     string `yaml:"id"`
	Label  string `yaml:"label,omitempty"`
	Prefix string `yaml:"prefix"`
}

type DeploymentApp struct {
	AppID              string              `yaml:"appId"`
	Domain             string              `yaml:"domain"`
	Subdomain          string              `yaml:"subdomain,omitempty"`
	UIBaseURL          string              `yaml:"uiBaseUrl"`
	UIBaseURLPrefixID  string              `yaml:"uiBaseUrlPrefixId,omitempty"`
	UIBaseURLSuffix    string              `yaml:"uiBaseUrlSuffix,omitempty"`
	APIBaseURL         string              `yaml:"apiBaseUrl"`
	APIBaseURLPrefixID string              `yaml:"apiBaseUrlPrefixId,omitempty"`
	APIBaseURLSuffix   string              `yaml:"apiBaseUrlSuffix,omitempty"`
	AppType            string              `yaml:"appType"`
	Visibility         string              `yaml:"visibility"`
	Name               string              `yaml:"name,omitempty"`
	SortOrder          int                 `yaml:"sortOrder,omitempty"`
	OAuth              *DeploymentAppOAuth `yaml:"oauth,omitempty"`
}

type DeploymentAppOAuth struct {
	Enabled bool `yaml:"enabled"`
}

type DeploymentOAuth struct {
	Enabled     bool                               `yaml:"enabled"`
	BridgeAppID string                             `yaml:"bridgeAppId"`
	Providers   map[string]DeploymentOAuthProvider `yaml:"providers"`
}

type DeploymentOAuthProvider struct {
	Enabled         bool   `yaml:"enabled"`
	ClientIDKey     string `yaml:"clientIdKey"`
	ClientSecretKey string `yaml:"clientSecretKey"`
	RedirectURI     string `yaml:"redirectUri"`
}

type ValidationIssue struct {
	Severity string
	Message  string
}

func LoadDeploymentConfig(deploymentPath, secretsPath string) (*DeploymentConfig, map[string]string, error) {
	data, err := os.ReadFile(deploymentPath)
	if err != nil {
		return nil, nil, fmt.Errorf("read deployment config: %w", err)
	}

	var doc DeploymentConfig
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, nil, fmt.Errorf("parse deployment config: %w", err)
	}

	secrets := map[string]string{}
	if strings.TrimSpace(secretsPath) != "" {
		loadedSecrets, err := loadEnvFile(secretsPath)
		if err != nil {
			return nil, nil, err
		}
		secrets = loadedSecrets
	}

	EnsureDeploymentDatabaseState(&doc, catalog.DefaultCatalog())

	return &doc, secrets, nil
}

func SaveDeploymentConfig(path string, doc *DeploymentConfig) error {
	if doc == nil {
		return fmt.Errorf("deployment document required")
	}

	EnsureDeploymentDatabaseState(doc, catalog.DefaultCatalog())

	data, err := yaml.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal deployment config: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create deployment config directory: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write deployment config: %w", err)
	}

	return nil
}

func SaveSecretsFile(path string, secrets map[string]string) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("secrets path required")
	}

	keys := make([]string, 0, len(secrets))
	for key := range secrets {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for _, key := range keys {
		builder.WriteString(key)
		builder.WriteString("=")
		builder.WriteString(secrets[key])
		builder.WriteString("\n")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create secrets directory: %w", err)
	}

	if err := os.WriteFile(path, []byte(builder.String()), 0600); err != nil {
		return fmt.Errorf("write secrets file: %w", err)
	}

	return nil
}

func loadEnvFile(path string) (map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("read deployment secrets: %w", err)
	}
	defer file.Close()

	values := map[string]string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			return nil, fmt.Errorf("invalid env line %q", line)
		}
		values[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan deployment secrets: %w", err)
	}

	return values, nil
}

func (d *DeploymentConfig) ToEnvironmentDefinition() *domain.EnvironmentDefinition {
	env := DefaultEnvironment()
	if d == nil {
		return env
	}

	if d.Environment.Name != "" {
		env.Name = d.Environment.Name
	}
	if d.Environment.Namespace != "" {
		env.Namespace = d.Environment.Namespace
	}
	if d.Environment.ComposeMode != "" {
		env.ComposeMode = domain.ComposeMode(d.Environment.ComposeMode)
	}
	if d.Environment.Provider != "" {
		env.Provider = domain.Provider(d.Environment.Provider)
	}
	if d.Environment.ImageOwner != "" {
		env.ImageOwner = d.Environment.ImageOwner
	}
	if d.Environment.DefaultTag != "" {
		env.DefaultTag = d.Environment.DefaultTag
	}
	env.Targets = nil
	for _, target := range d.Environment.Targets {
		env.Targets = append(env.Targets, domain.Target(target))
	}
	env.IncludeInfra = nil
	for _, infra := range d.Environment.Infra {
		env.IncludeInfra = append(env.IncludeInfra, domain.InfraKind(infra))
	}
	env.Capabilities = append([]string(nil), d.Environment.Capabilities...)
	EnsureDeploymentDatabaseState(d, catalog.DefaultCatalog())
	env.DatabaseSlots = nil
	for _, slot := range d.Databases {
		env.DatabaseSlots = append(env.DatabaseSlots, deploymentSlotToDomain(slot))
	}
	env.Services = nil
	for _, service := range d.Services {
		selection := deploymentServiceToDomain(service)
		if selection.DatabaseBinding != nil {
			for _, slot := range env.DatabaseSlots {
				if slot.ID == selection.DatabaseBinding.SlotID {
					selection.DatabaseBinding.Infra = slot.Infra
					selection.DatabaseBinding.Shared = false
					break
				}
			}
		}
		env.Services = append(env.Services, selection)
	}
	return env
}

func DeploymentConfigFromEnvironment(env *domain.EnvironmentDefinition) *DeploymentConfig {
	if env == nil {
		env = DefaultEnvironment()
	}
	env.Normalize()

	targets := make([]string, 0, len(env.Targets))
	for _, target := range env.Targets {
		targets = append(targets, string(target))
	}

	infra := make([]string, 0, len(env.IncludeInfra))
	for _, item := range env.IncludeInfra {
		infra = append(infra, string(item))
	}

	services := make([]string, 0, len(env.Services))
	apps := make([]DeploymentApp, 0)
	cat := catalog.DefaultCatalog()
	serviceDetails := make([]DeploymentService, 0, len(env.Services))
	for _, service := range env.Services {
		if !service.Enabled {
			continue
		}
		services = append(services, service.ServiceID)
		serviceDetails = append(serviceDetails, domainServiceToDeployment(service))
		preset, ok := cat.Get(service.ServiceID)
		if !ok || preset.Category != catalog.CategoryClient {
			continue
		}
		domainName := service.ServiceID + ".example.com"
		apps = append(apps, DeploymentApp{
			AppID:      service.ServiceID,
			Name:       preset.Name,
			Domain:     domainName,
			UIBaseURL:  "https://" + domainName,
			APIBaseURL: "https://gateway.example.com/api",
			AppType:    "client",
			Visibility: "public",
		})
	}

	doc := &DeploymentConfig{
		Version: "v1alpha1",
		Environment: DeploymentEnvironment{
			Name:         env.Name,
			Namespace:    env.Namespace,
			Targets:      targets,
			ComposeMode:  string(env.ComposeMode),
			Provider:     string(env.Provider),
			ImageOwner:   env.ImageOwner,
			DefaultTag:   env.DefaultTag,
			Infra:        infra,
			Capabilities: append([]string(nil), env.Capabilities...),
			Services:     services,
		},
		Databases: func() []DeploymentDatabaseSlot {
			out := make([]DeploymentDatabaseSlot, 0, len(env.DatabaseSlots))
			for _, slot := range env.DatabaseSlots {
				out = append(out, domainSlotToDeployment(slot))
			}
			return out
		}(),
		Services: serviceDetails,
		Gateway: DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		Apps: apps,
	}

	EnsureDeploymentDatabaseState(doc, cat)

	for _, app := range apps {
		if app.AppID == "client-interface" {
			bridgeCallbackBase := strings.TrimSuffix(resolveAppUIBaseURL(doc, app), "/")
			doc.OAuth = DeploymentOAuth{
				Enabled:     true,
				BridgeAppID: "client-interface",
				Providers: map[string]DeploymentOAuthProvider{
					"google": {
						Enabled:         true,
						ClientIDKey:     "GOOGLE_CLIENT_ID",
						ClientSecretKey: "GOOGLE_CLIENT_SECRET",
						RedirectURI:     bridgeCallbackBase + "/oauth/callback/google",
					},
				},
			}
			break
		}
	}

	return doc
}

func ValidateDeploymentArtifacts(doc *DeploymentConfig, secrets map[string]string, cat *catalog.Catalog) []ValidationIssue {
	if cat == nil {
		cat = catalog.DefaultCatalog()
	}

	issues := make([]ValidationIssue, 0)
	if doc == nil {
		return append(issues, ValidationIssue{Severity: "error", Message: "deployment document is required"})
	}

	if strings.TrimSpace(doc.Environment.Name) == "" {
		issues = append(issues, ValidationIssue{Severity: "error", Message: "environment name is required"})
	}

	serviceSet := map[string]struct{}{}
	for _, serviceID := range doc.Environment.Services {
		serviceSet[serviceID] = struct{}{}
	}

	if _, ok := serviceSet["gateway"]; !ok && len(doc.Apps) > 0 {
		issues = append(issues, ValidationIssue{Severity: "error", Message: "gateway service is required when apps are deployed"})
	}

	if strings.TrimSpace(doc.Gateway.InternalURL) == "" {
		issues = append(issues, ValidationIssue{Severity: "error", Message: "gateway.internalUrl is required"})
	}
	if strings.TrimSpace(doc.Gateway.InternalWSURL) == "" && hasWebsocketProxyClients(doc, cat) {
		issues = append(issues, ValidationIssue{Severity: "error", Message: "gateway.internalWsUrl is required for websocket-enabled clients"})
	}

	prefixes := deploymentPrefixMap(doc.URLPrefixes)
	seenPrefixes := map[string]struct{}{}
	for _, prefix := range doc.URLPrefixes {
		if strings.TrimSpace(prefix.ID) == "" {
			issues = append(issues, ValidationIssue{Severity: "error", Message: "urlPrefixes entries must define an id"})
			continue
		}
		if _, exists := seenPrefixes[prefix.ID]; exists {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("duplicate urlPrefix %s", prefix.ID)})
		}
		seenPrefixes[prefix.ID] = struct{}{}
		if strings.TrimSpace(prefix.Prefix) == "" {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("urlPrefix %s must define prefix", prefix.ID)})
		}
	}

	appIDs := map[string]struct{}{}
	for _, app := range doc.Apps {
		if _, seen := appIDs[app.AppID]; seen {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("duplicate app %s", app.AppID)})
			continue
		}
		appIDs[app.AppID] = struct{}{}

		preset, ok := cat.Get(app.AppID)
		if !ok {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s is not present in the deployment catalog", app.AppID)})
			continue
		}
		if preset.Category != catalog.CategoryClient {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s is not a frontend client", app.AppID)})
		}
		if _, enabled := serviceSet[app.AppID]; !enabled {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s is not enabled in environment.services", app.AppID)})
		}
		if strings.TrimSpace(app.Domain) == "" {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s must define a domain", app.AppID)})
		}
		if strings.TrimSpace(app.UIBaseURLPrefixID) != "" {
			if _, ok := prefixes[app.UIBaseURLPrefixID]; !ok {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s references unknown uiBaseUrlPrefixId %s", app.AppID, app.UIBaseURLPrefixID)})
			}
		}
		if strings.TrimSpace(app.APIBaseURLPrefixID) != "" {
			if _, ok := prefixes[app.APIBaseURLPrefixID]; !ok {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s references unknown apiBaseUrlPrefixId %s", app.AppID, app.APIBaseURLPrefixID)})
			}
		}
		if strings.TrimSpace(resolveAppUIBaseURL(doc, app)) == "" {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s must define uiBaseUrl", app.AppID)})
		}
		if strings.TrimSpace(resolveAppAPIBaseURL(doc, app)) == "" {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("app %s must define apiBaseUrl", app.AppID)})
		}

		issues = append(issues, validateClientProxy(app.AppID, preset)...)
	}

	if doc.OAuth.Enabled {
		if strings.TrimSpace(doc.OAuth.BridgeAppID) == "" {
			issues = append(issues, ValidationIssue{Severity: "error", Message: "oauth.bridgeAppId is required when OAuth is enabled"})
		} else if _, ok := appIDs[doc.OAuth.BridgeAppID]; !ok {
			issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("oauth bridge app %s is not present in deployed apps", doc.OAuth.BridgeAppID)})
		}

		for provider, config := range doc.OAuth.Providers {
			if !config.Enabled {
				continue
			}
			if strings.TrimSpace(config.ClientIDKey) == "" || strings.TrimSpace(config.ClientSecretKey) == "" {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("oauth provider %s must define clientIdKey and clientSecretKey", provider)})
				continue
			}
			if strings.TrimSpace(config.RedirectURI) == "" {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("oauth provider %s must define redirectUri", provider)})
			}
			if strings.TrimSpace(secrets[config.ClientIDKey]) == "" {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("oauth provider %s is missing secret value for %s", provider, config.ClientIDKey)})
			}
			if strings.TrimSpace(secrets[config.ClientSecretKey]) == "" {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("oauth provider %s is missing secret value for %s", provider, config.ClientSecretKey)})
			}
		}
	}

	if needsJWTSecret(serviceSet, doc) && strings.TrimSpace(secrets["JWT_SECRET"]) == "" {
		issues = append(issues, ValidationIssue{Severity: "error", Message: "JWT_SECRET is required for gateway/authentication deployments"})
	}

	if _, ok := serviceSet["postgres"]; ok || containsInfra(doc.Environment.Infra, "postgres") || len(doc.Environment.Services) > 0 {
		report := BuildDatabaseReadiness(doc, cat, secrets)
		for _, warning := range report.Warnings {
			issues = append(issues, ValidationIssue{Severity: "error", Message: warning})
		}
		for _, slot := range report.Slots {
			for _, warning := range slot.Warnings {
				issues = append(issues, ValidationIssue{Severity: "error", Message: fmt.Sprintf("database slot %s: %s", slot.Slot.ID, warning)})
			}
		}
	}

	return issues
}

func GenerateDeploymentArtifacts(doc *DeploymentConfig, secrets map[string]string, cat *catalog.Catalog, writer *output.Writer) (GenerateResult, error) {
	if cat == nil {
		cat = catalog.DefaultCatalog()
	}
	if writer == nil {
		return GenerateResult{}, fmt.Errorf("writer required")
	}
	if doc == nil {
		return GenerateResult{}, fmt.Errorf("deployment document required")
	}

	issues := ValidateDeploymentArtifacts(doc, secrets, cat)
	for _, issue := range issues {
		if issue.Severity == "error" {
			return GenerateResult{}, fmt.Errorf("deployment validation failed: %s", issue.Message)
		}
	}

	env := doc.ToEnvironmentDefinition()
	env.OutputDir = writer.BaseDir
	result, err := GenerateEnvironment(env, cat, writer)
	if err != nil {
		return GenerateResult{}, err
	}

	registryBytes, err := generateRegistryJSON(doc)
	if err != nil {
		return GenerateResult{}, err
	}
	if err := writer.WriteAppRegistry(registryBytes); err != nil {
		return GenerateResult{}, fmt.Errorf("write generated registry: %w", err)
	}
	result.RegistryPath = filepath.Join("config", "app-registry.generated.json")

	runtimeEnv := renderRuntimeEnv(doc, secrets, cat)
	if err := writer.WriteRuntimeEnv([]byte(runtimeEnv)); err != nil {
		return GenerateResult{}, fmt.Errorf("write runtime env: %w", err)
	}
	result.RuntimeEnvPath = filepath.Join("config", "runtime.env")

	dbSetupPlan := renderDBSetupPlan(doc, cat, secrets)
	if err := writer.WriteDBSetupPlan([]byte(dbSetupPlan)); err != nil {
		return GenerateResult{}, fmt.Errorf("write db-setup plan: %w", err)
	}
	result.DatabaseSetupPath = filepath.Join("config", "db-setup.generated.yaml")

	validationReport := renderValidationReport(issues)
	if err := writer.WriteValidationReport([]byte(validationReport)); err != nil {
		return GenerateResult{}, fmt.Errorf("write validation report: %w", err)
	}
	result.ValidationReportPath = filepath.Join("reports", "validation.txt")

	return result, nil
}

func generateRegistryJSON(doc *DeploymentConfig) ([]byte, error) {
	type registryApp struct {
		AppID      string `json:"appId"`
		Name       string `json:"name"`
		Domain     string `json:"domain"`
		Subdomain  string `json:"subdomain,omitempty"`
		UIBaseURL  string `json:"uiBaseUrl"`
		APIBaseURL string `json:"apiBaseUrl"`
		AppType    string `json:"appType"`
		Visibility string `json:"visibility"`
		SortOrder  int    `json:"sortOrder,omitempty"`
	}
	type registry struct {
		Version     string        `json:"version"`
		GeneratedAt string        `json:"generatedAt"`
		Apps        []registryApp `json:"apps"`
	}

	apps := make([]registryApp, 0, len(doc.Apps))
	for _, app := range doc.Apps {
		name := app.Name
		if strings.TrimSpace(name) == "" {
			name = app.AppID
		}
		apps = append(apps, registryApp{
			AppID:      app.AppID,
			Name:       name,
			Domain:     app.Domain,
			Subdomain:  app.Subdomain,
			UIBaseURL:  resolveAppUIBaseURL(doc, app),
			APIBaseURL: resolveAppAPIBaseURL(doc, app),
			AppType:    app.AppType,
			Visibility: app.Visibility,
			SortOrder:  app.SortOrder,
		})
	}
	sort.Slice(apps, func(i, j int) bool {
		if apps[i].SortOrder == apps[j].SortOrder {
			return apps[i].AppID < apps[j].AppID
		}
		return apps[i].SortOrder < apps[j].SortOrder
	})

	return json.MarshalIndent(registry{
		Version:     "1.0.0",
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Apps:        apps,
	}, "", "  ")
}

func renderRuntimeEnv(doc *DeploymentConfig, secrets map[string]string, cat *catalog.Catalog) string {
	report := BuildDatabaseReadiness(doc, cat, secrets)
	values := map[string]string{
		"NODE_ENV":               "production",
		"GATEWAY_URL":            doc.Gateway.InternalURL,
		"GATEWAY_WS_URL":         doc.Gateway.InternalWSURL,
		"GATEWAY_API_URL":        strings.TrimRight(doc.Gateway.InternalURL, "/") + "/api",
		"APP_REGISTRY_HOST_PATH": "./config/app-registry.generated.json",
		"APP_REGISTRY_PATH":      "/usr/src/app/config/app-registry.json",
	}

	copyIfPresent := func(key string) {
		if value := strings.TrimSpace(secrets[key]); value != "" {
			values[key] = value
		}
	}

	for _, key := range []string{
		"PRODUCTION_IMAGE_TAG",
		"JWT_SECRET",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
		"REDIS_PASSWORD",
	} {
		copyIfPresent(key)
	}

	if values["POSTGRES_USER"] == "" {
		values["POSTGRES_USER"] = "postgres"
	}
	if values["POSTGRES_DB"] == "" {
		values["POSTGRES_DB"] = "postgres"
	}
	for _, slot := range report.Slots {
		switch slot.Slot.Infra {
		case domain.InfraPostgres:
			values["POSTGRES_HOST"] = slot.Slot.Host
			values["POSTGRES_PORT"] = fmt.Sprintf("%d", slot.Slot.Port)
			if values["POSTGRES_DB"] == "" {
				values["POSTGRES_DB"] = slot.Slot.DatabaseName
			}
			if values["POSTGRES_USER"] == "" {
				values["POSTGRES_USER"] = slot.Slot.Username
			}
		case domain.InfraRedis:
			values["REDIS_HOST"] = slot.Slot.Host
			values["REDIS_PORT"] = fmt.Sprintf("%d", slot.Slot.Port)
		}
	}

	for _, serviceID := range doc.Environment.Services {
		if preset, ok := cat.Get(serviceID); ok && preset.Compose.ExternalPort > 0 {
			values[portEnvKey(serviceID)] = fmt.Sprintf("%d", preset.Compose.ExternalPort)
		}
	}
	for _, binding := range report.ServiceBindings {
		prefix := strings.ToUpper(strings.ReplaceAll(binding.ServiceID, "-", "_"))
		values[prefix+"_DB_SLOT"] = binding.SlotID
		values[prefix+"_DB_HOST"] = binding.Host
		if binding.Port > 0 {
			values[prefix+"_DB_PORT"] = fmt.Sprintf("%d", binding.Port)
		}
		values[prefix+"_DB_NAME"] = binding.DatabaseName
		values[prefix+"_DB_USER"] = binding.Username
		values[prefix+"_DB_PASSWORD_KEY"] = binding.PasswordKey
		values[prefix+"_DB_PROVISION_MODE"] = string(binding.ProvisionMode)
	}
	if _, ok := containsService(doc.Environment.Services, "gateway"); ok {
		values["GATEWAY_CHAT_SOCKET_PORT"] = "3300"
		values["GATEWAY_SOCIAL_SOCKET_PORT"] = "3301"
	}

	if doc.OAuth.Enabled {
		for provider, config := range doc.OAuth.Providers {
			if !config.Enabled {
				continue
			}
			prefix := strings.ToUpper(provider)
			if value := strings.TrimSpace(secrets[config.ClientIDKey]); value != "" {
				values[prefix+"_CLIENT_ID"] = value
			}
			if value := strings.TrimSpace(secrets[config.ClientSecretKey]); value != "" {
				values[prefix+"_CLIENT_SECRET"] = value
			}
			if strings.TrimSpace(config.RedirectURI) != "" {
				values[prefix+"_REDIRECT_URI"] = config.RedirectURI
			}
		}
	}

	keys := make([]string, 0, len(values))
	for key, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for _, key := range keys {
		builder.WriteString(key)
		builder.WriteString("=")
		builder.WriteString(values[key])
		builder.WriteString("\n")
	}
	return builder.String()
}

func renderDBSetupPlan(doc *DeploymentConfig, cat *catalog.Catalog, secrets map[string]string) string {
	report := BuildDatabaseReadiness(doc, cat, secrets)
	var builder strings.Builder
	builder.WriteString("version: v1alpha1\n")
	builder.WriteString("slots:\n")
	for _, slot := range report.Slots {
		builder.WriteString(fmt.Sprintf("  - id: %s\n", slot.Slot.ID))
		builder.WriteString(fmt.Sprintf("    infra: %s\n", slot.Slot.Infra))
		builder.WriteString(fmt.Sprintf("    provisionMode: %s\n", slot.Slot.ProvisionMode))
		builder.WriteString(fmt.Sprintf("    host: %s\n", slot.Slot.Host))
		builder.WriteString(fmt.Sprintf("    port: %d\n", slot.Slot.Port))
		builder.WriteString(fmt.Sprintf("    databaseName: %s\n", slot.Slot.DatabaseName))
		builder.WriteString(fmt.Sprintf("    username: %s\n", slot.Slot.Username))
		builder.WriteString(fmt.Sprintf("    passwordKey: %s\n", slot.Slot.PasswordKey))
		builder.WriteString(fmt.Sprintf("    create: %t\n", slot.Slot.Create))
		builder.WriteString(fmt.Sprintf("    migrate: %t\n", slot.Slot.Migrate))
		builder.WriteString(fmt.Sprintf("    seed: %t\n", slot.Slot.Seed))
		if len(slot.AttachedServices) > 0 {
			builder.WriteString("    attachedServices:\n")
			for _, serviceID := range slot.AttachedServices {
				builder.WriteString(fmt.Sprintf("      - %s\n", serviceID))
			}
		}
	}
	builder.WriteString("serviceBindings:\n")
	for _, binding := range report.ServiceBindings {
		builder.WriteString(fmt.Sprintf("  - serviceId: %s\n", binding.ServiceID))
		builder.WriteString(fmt.Sprintf("    infra: %s\n", binding.Infra))
		builder.WriteString(fmt.Sprintf("    slotId: %s\n", binding.SlotID))
		builder.WriteString(fmt.Sprintf("    databaseName: %s\n", binding.DatabaseName))
		builder.WriteString(fmt.Sprintf("    username: %s\n", binding.Username))
		builder.WriteString(fmt.Sprintf("    passwordKey: %s\n", binding.PasswordKey))
		builder.WriteString(fmt.Sprintf("    inherited: %t\n", binding.Inherited))
	}
	return builder.String()
}

func deploymentPrefixMap(prefixes []DeploymentURLPrefix) map[string]DeploymentURLPrefix {
	out := make(map[string]DeploymentURLPrefix, len(prefixes))
	for _, prefix := range prefixes {
		if id := strings.TrimSpace(prefix.ID); id != "" {
			out[id] = prefix
		}
	}
	return out
}

func resolveAppUIBaseURL(doc *DeploymentConfig, app DeploymentApp) string {
	return ResolveDeploymentAppUIBaseURL(doc, app)
}

func resolveAppAPIBaseURL(doc *DeploymentConfig, app DeploymentApp) string {
	return ResolveDeploymentAppAPIBaseURL(doc, app)
}

func ResolveDeploymentAppUIBaseURL(doc *DeploymentConfig, app DeploymentApp) string {
	if strings.TrimSpace(app.UIBaseURL) != "" {
		return strings.TrimSpace(app.UIBaseURL)
	}
	if doc == nil {
		return buildURLFromDomain(app.Domain, app.Subdomain)
	}
	return resolveUIBaseURLValue(doc.URLPrefixes, app.UIBaseURLPrefixID, app.Domain, app.Subdomain)
}

func ResolveDeploymentAppAPIBaseURL(doc *DeploymentConfig, app DeploymentApp) string {
	if strings.TrimSpace(app.APIBaseURL) != "" {
		return strings.TrimSpace(app.APIBaseURL)
	}
	resolvedUI := ResolveDeploymentAppUIBaseURL(doc, app)
	if strings.TrimSpace(resolvedUI) != "" {
		return strings.TrimRight(strings.TrimSpace(resolvedUI), "/") + "/api"
	}
	if doc == nil {
		return ""
	}
	return resolveLegacyURLValue(doc.URLPrefixes, app.APIBaseURLPrefixID, app.APIBaseURLSuffix, app.APIBaseURL, app.Domain, app.Subdomain)
}

func resolveUIBaseURLValue(prefixes []DeploymentURLPrefix, prefixID, domain, subdomain string) string {
	if strings.TrimSpace(prefixID) == "" {
		return buildURLFromDomain(domain, subdomain)
	}
	for _, prefix := range prefixes {
		if prefix.ID == prefixID {
			return spliceSubdomainIntoBaseURL(prefix.Prefix, subdomain)
		}
	}
	return buildURLFromDomain(domain, subdomain)
}

func resolveLegacyURLValue(prefixes []DeploymentURLPrefix, prefixID, suffix, fallback, domain, subdomain string) string {
	if strings.TrimSpace(prefixID) == "" {
		return strings.TrimSpace(fallback)
	}
	effectiveSuffix := strings.TrimSpace(suffix)
	if effectiveSuffix == "" {
		effectiveSuffix = appHost(domain, subdomain)
	}
	for _, prefix := range prefixes {
		if prefix.ID == prefixID {
			return strings.TrimSpace(prefix.Prefix + effectiveSuffix)
		}
	}
	return strings.TrimSpace(fallback)
}

func appHost(domain, subdomain string) string {
	base := strings.TrimSpace(domain)
	if strings.TrimSpace(subdomain) == "" {
		return base
	}
	if base == "" {
		return strings.TrimSpace(subdomain)
	}
	return strings.TrimSpace(subdomain) + "." + base
}

func buildURLFromDomain(domain, subdomain string) string {
	host := appHost(domain, subdomain)
	if strings.TrimSpace(host) == "" {
		return ""
	}
	return "https://" + host
}

func spliceSubdomainIntoBaseURL(baseURL, subdomain string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return ""
	}
	if strings.TrimSpace(subdomain) == "" {
		return trimmed
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return trimmed
	}

	host := parsed.Hostname()
	if host == "" {
		return trimmed
	}
	port := parsed.Port()
	parsed.Host = strings.TrimSpace(subdomain) + "." + host
	if port != "" {
		parsed.Host = net.JoinHostPort(parsed.Host, port)
	}
	return parsed.String()
}

func renderValidationReport(issues []ValidationIssue) string {
	if len(issues) == 0 {
		return "No validation issues found.\n"
	}

	var builder strings.Builder
	for _, issue := range issues {
		builder.WriteString(strings.ToUpper(issue.Severity))
		builder.WriteString(": ")
		builder.WriteString(issue.Message)
		builder.WriteString("\n")
	}
	return builder.String()
}

func validateClientProxy(appID string, preset catalog.Preset) []ValidationIssue {
	issues := make([]ValidationIssue, 0)
	serverPath := serverPathFromDockerfile(preset.Compose.Dockerfile)
	if serverPath == "" {
		return issues
	}

	data, err := os.ReadFile(serverPath)
	if err != nil {
		return append(issues, ValidationIssue{
			Severity: "warning",
			Message:  fmt.Sprintf("could not inspect proxy file for %s at %s", appID, serverPath),
		})
	}

	text := string(data)
	if strings.Contains(text, "http://gateway:3000/api") {
		issues = append(issues, ValidationIssue{
			Severity: "error",
			Message:  fmt.Sprintf("app %s server proxy contains hardcoded gateway api target", appID),
		})
	}
	if !containsAny(text, "process.env['GATEWAY_URL']", "process.env[\"GATEWAY_URL\"]", "process.env.GATEWAY_URL") {
		issues = append(issues, ValidationIssue{
			Severity: "error",
			Message:  fmt.Sprintf("app %s server proxy must read GATEWAY_URL from the environment", appID),
		})
	}
	if (strings.Contains(text, "/socket.io") || strings.Contains(text, "/chat")) &&
		!containsAny(text, "process.env['GATEWAY_WS_URL']", "process.env[\"GATEWAY_WS_URL\"]", "process.env.GATEWAY_WS_URL") {
		issues = append(issues, ValidationIssue{
			Severity: "error",
			Message:  fmt.Sprintf("app %s websocket proxy must read GATEWAY_WS_URL from the environment", appID),
		})
	}

	return issues
}

func containsAny(text string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(text, needle) {
			return true
		}
	}
	return false
}

func serverPathFromDockerfile(dockerfile string) string {
	trimmed := strings.TrimPrefix(dockerfile, "./")
	trimmed = strings.TrimSuffix(trimmed, "/Dockerfile")
	if trimmed == dockerfile || trimmed == "" {
		return ""
	}
	return filepath.Join("..", "..", trimmed, "src", "server.ts")
}

func findDeploymentApp(apps []DeploymentApp, appID string) *DeploymentApp {
	for i := range apps {
		if apps[i].AppID == appID {
			return &apps[i]
		}
	}
	return nil
}

func hasWebsocketProxyClients(doc *DeploymentConfig, cat *catalog.Catalog) bool {
	for _, app := range doc.Apps {
		preset, ok := cat.Get(app.AppID)
		if !ok {
			continue
		}
		serverPath := serverPathFromDockerfile(preset.Compose.Dockerfile)
		if serverPath == "" {
			continue
		}
		data, err := os.ReadFile(serverPath)
		if err != nil {
			continue
		}
		text := string(data)
		if strings.Contains(text, "/socket.io") || strings.Contains(text, "/chat") {
			return true
		}
	}
	return false
}

func containsInfra(infra []string, target string) bool {
	for _, item := range infra {
		if item == target {
			return true
		}
	}
	return false
}

func containsService(services []string, target string) (int, bool) {
	for index, service := range services {
		if service == target {
			return index, true
		}
	}
	return -1, false
}

func needsJWTSecret(serviceSet map[string]struct{}, doc *DeploymentConfig) bool {
	if doc.OAuth.Enabled {
		return true
	}
	_, hasGateway := serviceSet["gateway"]
	_, hasAuthentication := serviceSet["authentication"]
	return hasGateway || hasAuthentication
}

func portEnvKey(serviceID string) string {
	switch serviceID {
	case "gateway":
		return "GATEWAY_PORT"
	case "client-interface":
		return "CLIENT_INTERFACE_PORT"
	case "owner-console":
		return "OWNER_CONSOLE_PORT"
	case "video-client":
		return "VIDEO_CLIENT_PORT"
	case "local-hub":
		return "LOCAL_HUB_PORT"
	case "store-client":
		return "STORE_CLIENT_PORT"
	case "business-site":
		return "BUSINESS_SITE_PORT"
	case "fin-commander":
		return "FIN_COMMANDER_PORT"
	case "system-configurator":
		return "SYSTEM_CONFIGURATOR_PORT"
	case "leads-app":
		return "LEADS_APP_PORT"
	}

	replacer := strings.NewReplacer("-", "_")
	return strings.ToUpper(replacer.Replace(serviceID)) + "_PORT"
}
