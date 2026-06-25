package adminapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/apply"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
)

type Store interface {
	Load() (*configurator.DeploymentConfig, map[string]string, error)
}

type StaticStore struct {
	Document *configurator.DeploymentConfig
	Secrets  map[string]string
}

func (s StaticStore) Load() (*configurator.DeploymentConfig, map[string]string, error) {
	return s.Document, s.Secrets, nil
}

type FileStore struct {
	DeploymentPath string
	SecretsPath    string
}

func (s FileStore) Load() (*configurator.DeploymentConfig, map[string]string, error) {
	doc, secrets, err := configurator.LoadDeploymentConfig(s.DeploymentPath, s.SecretsPath)
	if err != nil {
		return nil, nil, err
	}
	return doc, mergeProcessSecrets(doc, secrets), nil
}

type Service struct {
	store      Store
	options    ServiceOptions
	executor   func(options apply.ComposeRolloutOptions) (apply.RolloutState, error)
	stateReader func(path string) (apply.RolloutState, error)
}

type ServiceOptions struct {
	WorkspaceRoot string
	ComposeEnvFile string
	Executor      func(options apply.ComposeRolloutOptions) (apply.RolloutState, error)
	StateReader   func(path string) (apply.RolloutState, error)
}

func NewService(store Store, options ...ServiceOptions) *Service {
	service := &Service{
		store:       store,
		executor:    executeComposeRollout,
		stateReader: apply.ReadRolloutState,
	}
	if len(options) > 0 {
		service.options = options[0]
		if service.options.Executor != nil {
			service.executor = service.options.Executor
		}
		if service.options.StateReader != nil {
			service.stateReader = service.options.StateReader
		}
	}
	return service
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/healthz/html", s.handleHealthHTML)
	mux.HandleFunc("/api/status/public", s.handlePublicStatus)
	mux.HandleFunc("/api/rollouts/preview", s.handleRolloutPreview)
	mux.HandleFunc("/api/rollouts/latest", s.handleLatestRollout)
	mux.HandleFunc("/api/rollouts/start", s.handleStartRollout)
	mux.HandleFunc("/api/oauth/inspect", s.handleOAuthInspect)
	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Service) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleHealthHTML(w http.ResponseWriter, _ *http.Request) {
	doc, secrets, err := s.store.Load()
	status := "healthy"
	details := ""
	if err != nil {
		status = "unhealthy"
		details = fmt.Sprintf("store error: %s", err.Error())
	}
	serviceCount := 0
	appCount := 0
	deploymentName := "unknown"
	provider := "unknown"
	defaultTag := "unknown"
	if doc != nil {
		deploymentName = doc.Environment.Name
		provider = doc.Environment.Provider
		defaultTag = doc.Environment.DefaultTag
		serviceCount = countEnabledServices(doc.Services)
		appCount = len(doc.Apps)
	}
	secretKeys := len(secrets)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>admin-env — %s</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;background:#fafafa;color:#1a1a1a}
  h1{font-size:1.5em;border-bottom:2px solid #ddd;padding-bottom:8px}
  .status{display:inline-block;padding:4px 12px;border-radius:4px;font-weight:600;font-size:.9em}
  .ok{background:#d4edda;color:#155724}
  .unhealthy{background:#f8d7da;color:#721c24}
  table{width:100%%;border-collapse:collapse;margin:16px 0}
  th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}
  th{font-weight:600;color:#555;font-size:.85em;text-transform:uppercase}
  td{font-family:monospace}
  .footer{margin-top:40px;font-size:.85em;color:#888;border-top:1px solid #eee;padding-top:16px}
</style></head>
<body>
<h1>admin-env <span class="status %s">%s</span></h1>
<table>
<tr><th>Deployment</th><td>%s</td></tr>
<tr><th>Provider</th><td>%s</td></tr>
<tr><th>Default Tag</th><td>%s</td></tr>
<tr><th>Services</th><td>%d enabled</td></tr>
<tr><th>Apps</th><td>%d registered</td></tr>
<tr><th>Secrets</th><td>%d keys</td></tr>
</table>
%s
<div class="footer">admin-env &middot; <a href="/api/status/public">/api/status/public</a> &middot; <a href="/api/oauth/inspect">/api/oauth/inspect</a> &middot; <a href="/api/rollouts/latest">/api/rollouts/latest</a></div>
</body>
</html>`, status, status, status, deploymentName, provider, defaultTag, serviceCount, appCount, secretKeys, details)
}

func (s *Service) handlePublicStatus(w http.ResponseWriter, _ *http.Request) {
	doc, _, err := s.store.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, buildPublicStatus(doc))
}

func (s *Service) handleRolloutPreview(w http.ResponseWriter, r *http.Request) {
	doc, _, err := s.store.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	targetTag := strings.TrimSpace(r.URL.Query().Get("tag"))
	if targetTag == "" {
		targetTag = doc.Environment.DefaultTag
	}
	writeJSON(w, http.StatusOK, buildRolloutPreview(doc, targetTag))
}

func (s *Service) handleLatestRollout(w http.ResponseWriter, _ *http.Request) {
	doc, _, err := s.store.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	state, err := s.stateReader(rolloutStatePath(s.workspaceRoot(), doc.Environment.Name))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (s *Service) handleStartRollout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	doc, _, err := s.store.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	var request struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid rollout request"})
		return
	}
	targetTag := strings.TrimSpace(request.Tag)
	if targetTag == "" {
		targetTag = doc.Environment.DefaultTag
	}
	state, err := s.executor(buildComposeRolloutOptions(doc, s.workspaceRoot(), s.composeEnvFile(), targetTag))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, state)
		return
	}
	writeJSON(w, http.StatusOK, state)
}

func (s *Service) handleOAuthInspect(w http.ResponseWriter, _ *http.Request) {
	doc, secrets, err := s.store.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, buildOAuthInspection(doc, secrets))
}

type PublicStatusResponse struct {
	DeploymentName string   `json:"deploymentName"`
	Namespace      string   `json:"namespace"`
	Provider       string   `json:"provider"`
	DefaultTag     string   `json:"defaultTag"`
	ServiceCount   int      `json:"serviceCount"`
	AppCount       int      `json:"appCount"`
	PublicHosts    []string `json:"publicHosts"`
	OAuthEnabled   bool     `json:"oauthEnabled"`
	OAuthProviders int      `json:"oauthProviders"`
}

type RolloutPreviewResponse struct {
	DeploymentName string     `json:"deploymentName"`
	CurrentTag     string     `json:"currentTag"`
	TargetTag      string     `json:"targetTag"`
	Strategy       string     `json:"strategy"`
	BatchSize      int        `json:"batchSize"`
	Services       []string   `json:"services"`
	Waves          [][]string `json:"waves"`
}

type OAuthInspectionResponse struct {
	Enabled   bool                    `json:"enabled"`
	BridgeApp string                  `json:"bridgeApp"`
	Providers []OAuthProviderResponse `json:"providers"`
}

type OAuthProviderResponse struct {
	Name                string `json:"name"`
	Enabled             bool   `json:"enabled"`
	ClientIDKey         string `json:"clientIdKey"`
	ClientIDPresent     bool   `json:"clientIdPresent"`
	ClientSecretKey     string `json:"clientSecretKey"`
	ClientSecretPresent bool   `json:"clientSecretPresent"`
	ClientSecretPreview string `json:"clientSecretPreview"`
	RedirectURI         string `json:"redirectUri"`
}

func buildPublicStatus(doc *configurator.DeploymentConfig) PublicStatusResponse {
	hosts := make([]string, 0, len(doc.Apps))
	providerCount := 0
	for _, app := range doc.Apps {
		if app.Domain != "" {
			hosts = append(hosts, app.Domain)
		}
	}
	sort.Strings(hosts)
	for _, provider := range doc.OAuth.Providers {
		if provider.Enabled {
			providerCount++
		}
	}

	return PublicStatusResponse{
		DeploymentName: doc.Environment.Name,
		Namespace:      doc.Environment.Namespace,
		Provider:       doc.Environment.Provider,
		DefaultTag:     doc.Environment.DefaultTag,
		ServiceCount:   countEnabledServices(doc.Services),
		AppCount:       len(doc.Apps),
		PublicHosts:    hosts,
		OAuthEnabled:   doc.OAuth.Enabled,
		OAuthProviders: providerCount,
	}
}

func buildRolloutPreview(doc *configurator.DeploymentConfig, targetTag string) RolloutPreviewResponse {
	services := enabledServiceIDs(doc.Services)
	batchSize := 4

	return RolloutPreviewResponse{
		DeploymentName: doc.Environment.Name,
		CurrentTag:     doc.Environment.DefaultTag,
		TargetTag:      targetTag,
		Strategy:       "scripts/docker-compose-deploy.sh",
		BatchSize:      batchSize,
		Services:       services,
		Waves:          buildRolloutWaves(services, batchSize),
	}
}

func buildOAuthInspection(doc *configurator.DeploymentConfig, secrets map[string]string) OAuthInspectionResponse {
	names := make([]string, 0, len(doc.OAuth.Providers))
	for name := range doc.OAuth.Providers {
		names = append(names, name)
	}
	sort.Strings(names)

	providers := make([]OAuthProviderResponse, 0, len(names))
	for _, name := range names {
		provider := doc.OAuth.Providers[name]
		secretValue := strings.TrimSpace(secrets[provider.ClientSecretKey])
		providers = append(providers, OAuthProviderResponse{
			Name:                name,
			Enabled:             provider.Enabled,
			ClientIDKey:         provider.ClientIDKey,
			ClientIDPresent:     strings.TrimSpace(secrets[provider.ClientIDKey]) != "",
			ClientSecretKey:     provider.ClientSecretKey,
			ClientSecretPresent: secretValue != "",
			ClientSecretPreview: maskSecret(secretValue),
			RedirectURI:         provider.RedirectURI,
		})
	}

	return OAuthInspectionResponse{
		Enabled:   doc.OAuth.Enabled,
		BridgeApp: doc.OAuth.BridgeAppID,
		Providers: providers,
	}
}

func mergeProcessSecrets(doc *configurator.DeploymentConfig, secrets map[string]string) map[string]string {
	merged := map[string]string{}
	for key, value := range secrets {
		merged[key] = value
	}
	for _, provider := range doc.OAuth.Providers {
		for _, key := range []string{provider.ClientIDKey, provider.ClientSecretKey} {
			if strings.TrimSpace(key) == "" {
				continue
			}
			if strings.TrimSpace(merged[key]) == "" {
				merged[key] = strings.TrimSpace(os.Getenv(key))
			}
		}
	}
	if strings.TrimSpace(merged["PRODUCTION_IMAGE_TAG"]) == "" {
		merged["PRODUCTION_IMAGE_TAG"] = strings.TrimSpace(os.Getenv("PRODUCTION_IMAGE_TAG"))
	}
	return merged
}

func countEnabledServices(services []configurator.DeploymentService) int {
	count := 0
	for _, service := range services {
		if service.Enabled {
			count++
		}
	}
	return count
}

func enabledServiceIDs(services []configurator.DeploymentService) []string {
	ids := make([]string, 0, len(services))
	for _, service := range services {
		if service.Enabled {
			ids = append(ids, service.ServiceID)
		}
	}
	return ids
}

func (s *Service) workspaceRoot() string {
	if strings.TrimSpace(s.options.WorkspaceRoot) != "" {
		return s.options.WorkspaceRoot
	}
	if root := strings.TrimSpace(os.Getenv("ADMIN_ENV_WORKSPACE_ROOT")); root != "" {
		return root
	}
	if cwd, err := os.Getwd(); err == nil {
		return filepath.Clean(filepath.Join(cwd, "..", ".."))
	}
	return "."
}

func rolloutStatePath(workspaceRoot, deploymentName string) string {
	return filepath.Join(workspaceRoot, "tmp", "admin-env", "rollouts", deploymentName+".json")
}

func buildComposeRolloutOptions(doc *configurator.DeploymentConfig, workspaceRoot, composeEnvFile, targetTag string) apply.ComposeRolloutOptions {
	return apply.ComposeRolloutOptions{
		DeploymentName: doc.Environment.Name,
		ProjectDir:     workspaceRoot,
		ScriptPath:     filepath.Join(workspaceRoot, "scripts", "docker-compose-deploy.sh"),
		ComposeEnvFile: composeEnvFile,
		TargetTag:      targetTag,
		BatchSize:      4,
		Services:       enabledServiceIDs(doc.Services),
		StatePath:      rolloutStatePath(workspaceRoot, doc.Environment.Name),
	}
}

func executeComposeRollout(options apply.ComposeRolloutOptions) (apply.RolloutState, error) {
	if strings.TrimSpace(options.ScriptPath) == "" {
		return apply.RolloutState{}, fmt.Errorf("script path required")
	}
	return apply.ExecuteComposeRollout(&apply.CommandRunner{}, options)
}

func (s *Service) composeEnvFile() string {
	if strings.TrimSpace(s.options.ComposeEnvFile) != "" {
		return strings.TrimSpace(s.options.ComposeEnvFile)
	}
	return strings.TrimSpace(os.Getenv("ADMIN_ENV_COMPOSE_ENV_FILE"))
}

func buildRolloutWaves(services []string, batchSize int) [][]string {
	if batchSize < 1 {
		batchSize = 4
	}
	waves := make([][]string, 0, (len(services)+batchSize-1)/batchSize)
	for i := 0; i < len(services); i += batchSize {
		end := i + batchSize
		if end > len(services) {
			end = len(services)
		}
		waves = append(waves, append([]string(nil), services[i:end]...))
	}
	return waves
}

func maskSecret(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 4 {
		return "****"
	}
	return "****" + value[len(value)-4:]
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
