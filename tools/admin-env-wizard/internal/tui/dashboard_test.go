package tui

import (
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
)

func TestDashboardHelpAndDocuments(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, map[string]string{"JWT_SECRET": "secret", "POSTGRES_PASSWORD": "postgres"})

	model.ActivateSection(SectionDatabases)
	if help := strings.ToLower(model.CurrentHelp()); !strings.Contains(help, "inherit") || !strings.Contains(help, "db-setup") {
		t.Fatalf("expected databases help to explain inheritance and db-setup, got %q", help)
	}
	if content := model.renderDatabasesDocument(); !strings.Contains(content, "Future db-setup intent") {
		t.Fatalf("expected databases document to include db-setup summary, got %q", content)
	}

	model.ActivateSection(SectionServices)
	if help := strings.ToLower(model.CurrentHelp()); !strings.Contains(help, "override") || !strings.Contains(help, "inherit") {
		t.Fatalf("expected services help to explain inherit vs override, got %q", help)
	}
	if content := model.renderServicesDocument(); !strings.Contains(content, "database") {
		t.Fatalf("expected services document to include effective database state, got %q", content)
	}
}

func TestDashboardDesktopMenusNavigateSections(t *testing.T) {
	model := NewDocumentModel(configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment()), "", nil, nil, nil, nil)

	model.OpenMenu(1)
	if !model.menuOpen {
		t.Fatal("expected menu to open")
	}
	model.MoveMenuItem(2)
	model.SelectActiveMenuItem()
	if model.ActiveSection() != SectionDatabases {
		t.Fatalf("expected databases section from navigate menu, got %s", model.ActiveSection())
	}

	model.OpenMenu(0)
	model.MoveMenu(1)
	if model.activeMenu != 1 {
		t.Fatalf("expected active menu to move right, got %d", model.activeMenu)
	}
}

func TestDashboardDiagnosticsGrouping(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	doc.Databases = []configurator.DeploymentDatabaseSlot{{ID: "postgres-primary", Infra: "postgres", ProvisionMode: "external", Host: "", Port: 5432, DatabaseName: "demo", Username: "postgres", PasswordKey: "POSTGRES_PASSWORD"}}
	model := NewDocumentModel(doc, "", nil, nil, nil, map[string]string{"JWT_SECRET": "secret"})
	model.ActivateSection(SectionDiagnostics)
	content := model.renderDiagnosticsDocument()
	if !strings.Contains(content, "database") {
		t.Fatalf("expected diagnostics to group database issues, got %q", content)
	}
}
