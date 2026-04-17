package catalog

import "testing"

func TestDeployableAppsIncludesExpectedServicesAndClients(t *testing.T) {
	catalog := DefaultCatalog()

	apps := catalog.DeployableApps()
	if len(apps) == 0 {
		t.Fatal("expected deployable apps")
	}

	want := map[string]struct{}{
		"classifieds":  {},
		"lead-tracker": {},
		"leads-app":    {},
		"local-hub":    {},
		"payments":     {},
	}

	for _, app := range apps {
		delete(want, app.ID)
	}

	if len(want) != 0 {
		t.Fatalf("missing expected deployable apps: %v", want)
	}
}

func TestDeployableAppsExposeComposeAliasesAndManifestPaths(t *testing.T) {
	catalog := DefaultCatalog()

	apps := catalog.DeployableApps()
	byID := map[string]DeployableApp{}
	for _, app := range apps {
		byID[app.ID] = app
	}

	tests := []struct {
		id             string
		composeService string
		manifestPath   string
	}{
		{
			id:             "client-interface",
			composeService: "ot-client-interface",
			manifestPath:   "k8s/base/clients/client-interface.yaml",
		},
		{
			id:             "christopherrutherford-net",
			composeService: "crdn-client-interface",
			manifestPath:   "k8s/base/clients/christopherrutherford-net.yaml",
		},
		{
			id:             "local-hub",
			composeService: "local-hub-client-interface",
			manifestPath:   "k8s/base/clients/local-hub.yaml",
		},
		{
			id:             "lead-tracker",
			composeService: "lead-tracker",
			manifestPath:   "k8s/base/services/lead-tracker.yaml",
		},
	}

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			app, ok := byID[tt.id]
			if !ok {
				t.Fatalf("expected deployable app %s", tt.id)
			}
			if app.ComposeServiceName != tt.composeService {
				t.Fatalf("expected compose service %s, got %s", tt.composeService, app.ComposeServiceName)
			}
			if app.K8sManifestPath != tt.manifestPath {
				t.Fatalf("expected manifest path %s, got %s", tt.manifestPath, app.K8sManifestPath)
			}
		})
	}
}
