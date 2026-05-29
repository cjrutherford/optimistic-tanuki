package configurator

import (
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

func TestDeploymentConfigRoundTripsDatabaseSlotsAndOverrides(t *testing.T) {
	env := &domain.EnvironmentDefinition{
		Name:        "demo",
		Namespace:   "optimistic-tanuki",
		Targets:     []domain.Target{domain.TargetCompose, domain.TargetK8s},
		ComposeMode: domain.ComposeModeImage,
		Provider:    domain.ProviderVultr,
		ImageOwner:  "cjrutherford",
		DefaultTag:  "latest",
		DatabaseSlots: []domain.DatabaseSlot{
			{ID: "postgres-primary", Infra: domain.InfraPostgres, ProvisionMode: domain.DatabaseProvisionManaged, Host: "db", Port: 5432, DatabaseName: "demo", Username: "postgres", PasswordKey: "POSTGRES_PASSWORD", Create: true, Migrate: true},
		},
		Services: []domain.ServiceSelection{
			{ServiceID: "gateway", Enabled: true, DatabaseBinding: &domain.DatabaseBinding{SlotID: "postgres-primary", Infra: domain.InfraPostgres, DatabaseName: "demo", Username: "postgres", PasswordKey: "POSTGRES_PASSWORD"}},
			{ServiceID: "authentication", Enabled: true, Replicas: 2, ImageTag: "2026.05", DatabaseBinding: &domain.DatabaseBinding{SlotID: "postgres-primary", Infra: domain.InfraPostgres, DatabaseName: "auth", Username: "client", PasswordKey: "CLIENT_DB_PASSWORD"}},
		},
	}

	doc := DeploymentConfigFromEnvironment(env)
	if len(doc.Databases) < 1 {
		t.Fatalf("expected at least one database slot, got %d", len(doc.Databases))
	}
	if len(doc.Services) != 2 {
		t.Fatalf("expected two service records, got %d", len(doc.Services))
	}
	var authService *DeploymentService
	for i := range doc.Services {
		if doc.Services[i].ServiceID == "authentication" {
			authService = &doc.Services[i]
			break
		}
	}
	if authService == nil || authService.Database == nil {
		t.Fatal("expected authentication service override to persist")
	}
	if got := authService.Database.PasswordKey; got != "CLIENT_DB_PASSWORD" {
		t.Fatalf("expected service override password key, got %q", got)
	}

	roundTrip := doc.ToEnvironmentDefinition()
	if len(roundTrip.DatabaseSlots) < 1 {
		t.Fatalf("expected at least one round-tripped database slot, got %d", len(roundTrip.DatabaseSlots))
	}
	var authSelection *domain.ServiceSelection
	for i := range roundTrip.Services {
		if roundTrip.Services[i].ServiceID == "authentication" {
			authSelection = &roundTrip.Services[i]
			break
		}
	}
	if authSelection == nil || authSelection.DatabaseBinding == nil {
		t.Fatal("expected authentication override after round trip")
	}
	if got := authSelection.DatabaseBinding.PasswordKey; got != "CLIENT_DB_PASSWORD" {
		t.Fatalf("expected service override to round trip, got %q", got)
	}
}

func TestBuildDatabaseReadinessReportsSlotsAndBindings(t *testing.T) {
	doc := &DeploymentConfig{
		Version: "v1alpha1",
		Environment: DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "optimistic-tanuki",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "authentication"},
		},
		Databases: []DeploymentDatabaseSlot{{ID: "postgres-primary", Infra: "postgres", ProvisionMode: "managed", Host: "db", Port: 5432, DatabaseName: "demo", Username: "postgres", PasswordKey: "POSTGRES_PASSWORD", Create: true, Migrate: true}},
		Services:  []DeploymentService{{ServiceID: "gateway", Enabled: true}, {ServiceID: "authentication", Enabled: true, Database: &DeploymentServiceDatabase{SlotID: "postgres-primary", DatabaseName: "auth", Username: "client", PasswordKey: "CLIENT_DB_PASSWORD"}}},
	}

	report := BuildDatabaseReadiness(doc, catalog.DefaultCatalog(), map[string]string{"POSTGRES_PASSWORD": "postgres", "CLIENT_DB_PASSWORD": "secret"})
	if len(report.Slots) < 1 {
		t.Fatalf("expected slot readiness records, got %d", len(report.Slots))
	}
	foundPostgres := false
	for _, slot := range report.Slots {
		if slot.Slot.ID != "postgres-primary" {
			continue
		}
		foundPostgres = true
		got := strings.Join(slot.AttachedServices, ",")
		if !strings.Contains(got, "authentication") || !strings.Contains(got, "gateway") {
			t.Fatalf("expected both services attached, got %q", got)
		}
	}
	if !foundPostgres {
		t.Fatal("expected postgres-primary slot in readiness report")
	}
	if len(report.ServiceBindings) == 0 {
		t.Fatal("expected resolved service bindings")
	}
	if !strings.Contains(strings.Join(report.DBSetupSummaries, "\n"), "create=true") {
		t.Fatalf("expected db-setup summary to include lifecycle flags, got %q", strings.Join(report.DBSetupSummaries, "\n"))
	}
}

func TestValidateDeploymentArtifactsRequiresDatabaseSlotSecrets(t *testing.T) {
	doc := &DeploymentConfig{
		Version: "v1alpha1",
		Environment: DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "optimistic-tanuki",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway"},
		},
		Databases: []DeploymentDatabaseSlot{{ID: "postgres-primary", Infra: "postgres", ProvisionMode: "external", Host: "", Port: 5432, DatabaseName: "demo", Username: "postgres", PasswordKey: "POSTGRES_PASSWORD"}},
		Services:  []DeploymentService{{ServiceID: "gateway", Enabled: true}},
		Gateway:   DeploymentGateway{InternalURL: "http://gateway:3000", InternalWSURL: "http://gateway:3300"},
	}

	issues := ValidateDeploymentArtifacts(doc, map[string]string{"JWT_SECRET": "secret"}, catalog.DefaultCatalog())
	joined := make([]string, 0, len(issues))
	for _, issue := range issues {
		joined = append(joined, issue.Message)
	}
	all := strings.Join(joined, "\n")
	if !strings.Contains(all, "external slots require a host") {
		t.Fatalf("expected slot readiness validation error, got %s", all)
	}
}
