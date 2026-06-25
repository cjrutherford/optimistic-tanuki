package adminapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/apply"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
)

func TestHandlerServesPublicStatusAndRolloutPreview(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:       "production",
			Namespace:  "optimistic-tanuki",
			Provider:   "vultr",
			DefaultTag: "sha-current",
		},
		Services: []configurator.DeploymentService{
			{ServiceID: "gateway", Enabled: true},
			{ServiceID: "authentication", Enabled: true},
			{ServiceID: "owner-console", Enabled: true},
		},
		Apps: []configurator.DeploymentApp{
			{
				AppID:      "client-interface",
				Domain:     "optimistic-tanuki.com",
				UIBaseURL:  "https://optimistic-tanuki.com",
				APIBaseURL: "https://optimistic-tanuki.com/api",
				AppType:    "client",
				Visibility: "public",
			},
		},
		OAuth: configurator.DeploymentOAuth{
			Enabled:     true,
			BridgeAppID: "client-interface",
			Providers: map[string]configurator.DeploymentOAuthProvider{
				"google": {
					Enabled:         true,
					ClientIDKey:     "GOOGLE_CLIENT_ID",
					ClientSecretKey: "GOOGLE_CLIENT_SECRET",
					RedirectURI:     "https://optimistic-tanuki.com/api/oauth/callback/google",
				},
			},
		},
	}

	service := NewService(StaticStore{
		Document: doc,
		Secrets: map[string]string{
			"GOOGLE_CLIENT_ID":     "google-client-id",
			"GOOGLE_CLIENT_SECRET": "super-secret-value",
		},
	})

	statusRequest := httptest.NewRequest(http.MethodGet, "/api/status/public", nil)
	statusResponse := httptest.NewRecorder()
	service.Handler().ServeHTTP(statusResponse, statusRequest)

	if statusResponse.Code != http.StatusOK {
		t.Fatalf("expected 200 from public status, got %d", statusResponse.Code)
	}
	if !strings.Contains(statusResponse.Body.String(), `"deploymentName":"production"`) {
		t.Fatalf("expected deployment name in status response, got %s", statusResponse.Body.String())
	}
	if !strings.Contains(statusResponse.Body.String(), `"publicHosts":["optimistic-tanuki.com"]`) {
		t.Fatalf("expected public host list in status response, got %s", statusResponse.Body.String())
	}

	rolloutRequest := httptest.NewRequest(http.MethodGet, "/api/rollouts/preview?tag=sha-next", nil)
	rolloutResponse := httptest.NewRecorder()
	service.Handler().ServeHTTP(rolloutResponse, rolloutRequest)

	if rolloutResponse.Code != http.StatusOK {
		t.Fatalf("expected 200 from rollout preview, got %d", rolloutResponse.Code)
	}
	if !strings.Contains(rolloutResponse.Body.String(), `"targetTag":"sha-next"`) {
		t.Fatalf("expected target tag in rollout response, got %s", rolloutResponse.Body.String())
	}
}

func TestHandlerServesOAuthInspectionWithoutRawSecrets(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name: "production",
		},
		OAuth: configurator.DeploymentOAuth{
			Enabled: true,
			Providers: map[string]configurator.DeploymentOAuthProvider{
				"google": {
					Enabled:         true,
					ClientIDKey:     "GOOGLE_CLIENT_ID",
					ClientSecretKey: "GOOGLE_CLIENT_SECRET",
					RedirectURI:     "https://optimistic-tanuki.com/api/oauth/callback/google",
				},
			},
		},
	}

	service := NewService(StaticStore{
		Document: doc,
		Secrets: map[string]string{
			"GOOGLE_CLIENT_ID":     "google-client-id",
			"GOOGLE_CLIENT_SECRET": "super-secret-value",
		},
	})

	request := httptest.NewRequest(http.MethodGet, "/api/oauth/inspect", nil)
	response := httptest.NewRecorder()
	service.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 from oauth inspect, got %d", response.Code)
	}
	if strings.Contains(response.Body.String(), "super-secret-value") {
		t.Fatalf("expected raw secrets to be withheld, got %s", response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"clientSecretPresent":true`) {
		t.Fatalf("expected secret presence flag, got %s", response.Body.String())
	}
}

func TestHandlerStartsAndReturnsLatestRollout(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:       "production",
			Namespace:  "optimistic-tanuki",
			Provider:   "vultr",
			DefaultTag: "sha-current",
		},
		Services: []configurator.DeploymentService{
			{ServiceID: "gateway", Enabled: true},
			{ServiceID: "authentication", Enabled: true},
			{ServiceID: "owner-console", Enabled: true},
		},
	}

	service := NewService(StaticStore{
		Document: doc,
		Secrets:  map[string]string{},
	}, ServiceOptions{
		WorkspaceRoot: "/workspace",
		Executor: func(options apply.ComposeRolloutOptions) (apply.RolloutState, error) {
			return apply.RolloutState{
				DeploymentName: options.DeploymentName,
				TargetTag:      options.TargetTag,
				Status:         apply.RolloutStatusSucceeded,
				BatchSize:      options.BatchSize,
			}, nil
		},
		StateReader: func(path string) (apply.RolloutState, error) {
			return apply.RolloutState{
				DeploymentName: "production",
				TargetTag:      "sha-next",
				Status:         apply.RolloutStatusSucceeded,
			}, nil
		},
	})

	startRequest := httptest.NewRequest(http.MethodPost, "/api/rollouts/start", bytes.NewBufferString(`{"tag":"sha-next"}`))
	startRequest.Header.Set("Content-Type", "application/json")
	startResponse := httptest.NewRecorder()
	service.Handler().ServeHTTP(startResponse, startRequest)

	if startResponse.Code != http.StatusOK {
		t.Fatalf("expected 200 from rollout start, got %d", startResponse.Code)
	}
	if !strings.Contains(startResponse.Body.String(), `"targetTag":"sha-next"`) {
		t.Fatalf("expected target tag in rollout start, got %s", startResponse.Body.String())
	}

	latestRequest := httptest.NewRequest(http.MethodGet, "/api/rollouts/latest", nil)
	latestResponse := httptest.NewRecorder()
	service.Handler().ServeHTTP(latestResponse, latestRequest)

	if latestResponse.Code != http.StatusOK {
		t.Fatalf("expected 200 from latest rollout, got %d", latestResponse.Code)
	}
	if !strings.Contains(latestResponse.Body.String(), `"status":"succeeded"`) {
		t.Fatalf("expected rollout status in latest response, got %s", latestResponse.Body.String())
	}
}
