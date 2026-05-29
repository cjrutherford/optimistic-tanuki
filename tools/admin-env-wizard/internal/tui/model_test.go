package tui

import (
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
)

func TestModelSaveAndGenerate(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	saved := false
	generated := false
	model := NewDocumentModel(doc, "/tmp/deployment.yaml", func(updated *configurator.DeploymentConfig) error {
		saved = updated != nil
		return nil
	}, func(map[string]string) error { return nil }, func() (configurator.GenerateResult, error) {
		generated = true
		return configurator.GenerateResult{OutputDir: "dist/admin-env/demo", DatabaseSetupPath: "config/db-setup.generated.yaml"}, nil
	}, map[string]string{"JWT_SECRET": "secret", "POSTGRES_PASSWORD": "postgres"})

	if err := model.SaveAll(); err != nil {
		t.Fatalf("SaveAll() error = %v", err)
	}
	if !saved {
		t.Fatal("expected save callback to run")
	}
	if err := model.Generate(); err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if !generated {
		t.Fatal("expected generate callback to run")
	}
	if !strings.Contains(model.renderApplyDocument(), "db-setup plan") {
		t.Fatalf("expected apply document to mention db-setup plan, got %q", model.renderApplyDocument())
	}
}

func TestModelDeletesDatabaseSlotAndClearsOverrides(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	doc.Services = append(doc.Services, configurator.DeploymentService{ServiceID: "client-interface", Enabled: true, Database: &configurator.DeploymentServiceDatabase{SlotID: "postgres-primary", DatabaseName: "client_interface", PasswordKey: "CLIENT_DB_PASSWORD"}})
	model := NewDocumentModel(doc, "", nil, nil, nil, map[string]string{"POSTGRES_PASSWORD": "postgres"})
	model.activeSlot = 0

	if ok := model.DeleteActiveDatabaseSlot(); !ok {
		t.Fatal("expected active database slot to be deleted")
	}
	if len(model.doc.Databases) == 0 {
		t.Fatal("expected defaults to rehydrate at least one slot after deletion")
	}
	for _, service := range model.doc.Services {
		if service.ServiceID == "client-interface" && service.Database != nil && service.Database.SlotID == "postgres-primary" {
			t.Fatal("expected service override slot to be cleared after deletion")
		}
	}
}
