package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
)

func TestModelAdvancesFromBasicsOnEnter(t *testing.T) {
	model := NewModel(configurator.DefaultEnvironment(), nil)

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)

	if m.step != stepTargets {
		t.Fatalf("expected targets step, got %v", m.step)
	}
}

func TestModelRunsGeneratorFromReview(t *testing.T) {
	called := false
	model := NewModel(configurator.DefaultEnvironment(), func() (configurator.GenerateResult, error) {
		called = true
		return configurator.GenerateResult{OutputDir: "dist/admin-env/test"}, nil
	})
	model.step = stepReview

	updated, cmd := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	if cmd == nil {
		t.Fatal("expected generate command")
	}

	msg := cmd()
	updated, _ = updated.(Model).Update(msg)
	m := updated.(Model)

	if !called {
		t.Fatal("expected generator callback to run")
	}
	if m.step != stepResult {
		t.Fatalf("expected result step, got %v", m.step)
	}
}

func TestDocumentModelAdvancesToGatewayAndApps(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepServices

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)
	if m.step != stepGateway {
		t.Fatalf("expected gateway step, got %v", m.step)
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.step != stepSecrets {
		t.Fatalf("expected secrets step, got %v", m.step)
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.step != stepPrefixes {
		t.Fatalf("expected prefixes step, got %v", m.step)
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRight})
	m = updated.(Model)
	if m.step != stepApps {
		t.Fatalf("expected apps step, got %v", m.step)
	}
}

func TestServicesSelectorCanSelectAll(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepServices
	for i := range model.services {
		model.services[i].selected = false
	}

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'a'}})
	m := updated.(Model)
	for _, service := range m.services {
		if !service.selected {
			t.Fatal("expected all services to be selected")
		}
	}
}

func TestServicesSelectorCanClearAll(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepServices
	for i := range model.services {
		model.services[i].selected = true
	}

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}})
	m := updated.(Model)
	for _, service := range m.services {
		if service.selected {
			t.Fatal("expected all services to be cleared")
		}
	}
}

func TestDocumentModelAddsPrefixWithPlainKey(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepPrefixes

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'a'}})
	m := updated.(Model)
	if len(m.doc.URLPrefixes) != 1 {
		t.Fatalf("expected one prefix to be added, got %d", len(m.doc.URLPrefixes))
	}
	if m.doc.URLPrefixes[0].ID != "prefix-1" {
		t.Fatalf("expected default prefix id, got %q", m.doc.URLPrefixes[0].ID)
	}
}

func TestDocumentModelEnterCreatesPrefixWhenEmpty(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepPrefixes

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)
	if m.step != stepPrefixEditor {
		t.Fatalf("expected prefix editor, got %v", m.step)
	}
	if len(m.doc.URLPrefixes) != 1 {
		t.Fatalf("expected one prefix to exist, got %d", len(m.doc.URLPrefixes))
	}
}

func TestDocumentModelEditsRegistryApp(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: configurator.DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		Apps: []configurator.DeploymentApp{
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

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepApps

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)
	if m.step != stepAppEditor {
		t.Fatalf("expected app editor step, got %v", m.step)
	}

	m.cursor = 2
	m.appInputs[2].SetValue("new.example.com")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	m = updated.(Model)
	if m.step != stepApps {
		t.Fatalf("expected return to apps step, got %v", m.step)
	}
	if m.doc.Apps[0].Domain != "new.example.com" {
		t.Fatalf("expected domain update, got %q", m.doc.Apps[0].Domain)
	}
}

func TestNewDocumentModelDoesNotCreateRegistryAppForServiceOnlyDeployment(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"authentication", "profile"},
		},
	}

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)

	if len(model.doc.Apps) != 0 {
		t.Fatalf("expected service-only deployment to keep zero apps, got %d", len(model.doc.Apps))
	}
}

func TestCtrlNFromBasicsSyncsPendingInputs(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepBasics
	model.inputs[0].SetValue("renamed-env")

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlN})
	m := updated.(Model)

	if m.step != stepTargets {
		t.Fatalf("expected targets step, got %v", m.step)
	}
	if got := m.doc.Environment.Name; got != "renamed-env" {
		t.Fatalf("expected basics change to sync before navigation, got %q", got)
	}
}

func TestCtrlNFromServicesSyncsPendingSelections(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Apps: []configurator.DeploymentApp{
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

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepServices
	for i := range model.services {
		if model.services[i].label == "client-interface" {
			model.services[i].selected = false
		}
	}

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlN})
	m := updated.(Model)

	if m.step != stepGateway {
		t.Fatalf("expected gateway step, got %v", m.step)
	}
	for _, service := range m.doc.Environment.Services {
		if service == "client-interface" {
			t.Fatal("expected service selection to sync before navigation")
		}
	}
	if len(m.doc.Apps) != 0 {
		t.Fatalf("expected registry apps to be filtered with services, got %d", len(m.doc.Apps))
	}
}

func TestCtrlNFromGatewaySyncsPendingURLs(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepGateway
	model.gatewayInputs[0].SetValue("https://new-gateway.example.com")

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlN})
	m := updated.(Model)

	if m.step != stepSecrets {
		t.Fatalf("expected secrets step, got %v", m.step)
	}
	if got := m.doc.Gateway.PublicURL; got != "https://new-gateway.example.com" {
		t.Fatalf("expected gateway change to sync before navigation, got %q", got)
	}
}

func TestJumpMenuSyncsPendingStepBeforeNavigation(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepBasics
	model.inputs[0].SetValue("jump-synced-env")

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlJ})
	m := updated.(Model)
	if m.step != stepJump {
		t.Fatalf("expected jump step, got %v", m.step)
	}

	m.cursor = 1
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)

	if m.step != stepTargets {
		t.Fatalf("expected targets step after jump selection, got %v", m.step)
	}
	if got := m.doc.Environment.Name; got != "jump-synced-env" {
		t.Fatalf("expected basics change to sync through jump navigation, got %q", got)
	}
}

func TestSaveAllPersistsSyncedServiceSelections(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Apps: []configurator.DeploymentApp{
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

	var saved *configurator.DeploymentConfig
	model := NewDocumentModel(doc, "", func(cfg *configurator.DeploymentConfig) error {
		saved = cfg
		return nil
	}, nil, nil, nil)
	model.step = stepServices
	for i := range model.services {
		if model.services[i].label == "client-interface" {
			model.services[i].selected = false
		}
	}

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlN})
	model = updated.(Model)
	model.step = stepApps

	updated, cmd := model.saveAll()
	if cmd == nil {
		t.Fatal("expected save command")
	}
	msg := cmd()
	updated, _ = updated.Update(msg)
	m := updated.(Model)

	if m.saveMessage != "Deployment files saved." {
		t.Fatalf("expected successful save message, got %q", m.saveMessage)
	}
	if saved == nil {
		t.Fatal("expected save callback to receive document")
	}
	for _, service := range saved.Environment.Services {
		if service == "client-interface" {
			t.Fatal("expected synced services to exclude client-interface on save")
		}
	}
	if len(saved.Apps) != 0 {
		t.Fatalf("expected synced registry apps to be filtered on save, got %d", len(saved.Apps))
	}
}

func TestDocumentModelEditsSecretValue(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, map[string]string{"JWT_SECRET": "before"})
	model.step = stepSecrets
	model.secretKeys = []string{"JWT_SECRET"}

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'e'}})
	m := updated.(Model)
	if m.step != stepSecretEditor {
		t.Fatalf("expected secret editor step, got %v", m.step)
	}

	m.secretInput.SetValue("after")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyCtrlS})
	m = updated.(Model)
	if m.step != stepSecrets {
		t.Fatalf("expected secrets step after save, got %v", m.step)
	}
	if m.secrets["JWT_SECRET"] != "after" {
		t.Fatalf("expected secret update, got %q", m.secrets["JWT_SECRET"])
	}
}

func TestDocumentModelClickingSecretRowOpensEditor(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, map[string]string{"JWT_SECRET": "before"})
	model.step = stepSecrets
	model.secretKeys = []string{"JWT_SECRET"}

	updated, _ := model.Update(tea.MouseMsg{
		X:      40,
		Y:      8,
		Action: tea.MouseActionPress,
		Button: tea.MouseButtonLeft,
	})
	m := updated.(Model)
	if m.step != stepSecretEditor {
		t.Fatalf("expected secret editor from row click, got %v", m.step)
	}
}

func TestDocumentModelClickingAppRowOpensEditor(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Apps: []configurator.DeploymentApp{
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
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepApps

	updated, _ := model.Update(tea.MouseMsg{
		X:      40,
		Y:      8,
		Action: tea.MouseActionPress,
		Button: tea.MouseButtonLeft,
	})
	m := updated.(Model)
	if m.step != stepAppEditor {
		t.Fatalf("expected app editor from row click, got %v", m.step)
	}
}

func TestDocumentModelCyclesPrefixSelection(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: configurator.DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		URLPrefixes: []configurator.DeploymentURLPrefix{
			{ID: "base-domain", Label: "Base Domain", Prefix: "https://example.com"},
		},
		Apps: []configurator.DeploymentApp{
			{
				AppID:      "client-interface",
				Name:       "Client Interface",
				Domain:     "example.com",
				Subdomain:  "app",
				UIBaseURL:  "https://app.example.com",
				APIBaseURL: "https://gateway.example.com/api",
				AppType:    "client",
				Visibility: "public",
			},
		},
	}

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepAppEditor
	model.appIndex = 0
	model.appInputs = model.newAppInputs()
	model.fieldCursor = 5
	model.appInputs[5].Focus()

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{']'}})
	m := updated.(Model)
	if got := m.appInputs[5].Value(); got != "base-domain" {
		t.Fatalf("expected prefix selection to cycle, got %q", got)
	}
}

func TestDocumentModelPrefixPickerSelectsOption(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: configurator.DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		URLPrefixes: []configurator.DeploymentURLPrefix{
			{ID: "base-domain", Label: "Base Domain", Prefix: "https://example.com"},
			{ID: "gateway-api", Label: "Gateway API", Prefix: "https://gateway.example.com"},
		},
		Apps: []configurator.DeploymentApp{
			{
				AppID:      "client-interface",
				Name:       "Client Interface",
				Domain:     "example.com",
				Subdomain:  "app",
				UIBaseURL:  "https://app.example.com",
				APIBaseURL: "https://gateway.example.com/api",
				AppType:    "client",
				Visibility: "public",
			},
		},
	}

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepAppEditor
	model.appIndex = 0
	model.appInputs = model.newAppInputs()
	model.fieldCursor = 5
	model.appInputs[5].Focus()

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)
	if !m.prefixPickerOpen {
		t.Fatal("expected prefix picker to open")
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m = updated.(Model)
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.prefixPickerOpen {
		t.Fatal("expected prefix picker to close after selection")
	}
	if got := m.appInputs[5].Value(); got != "base-domain" {
		t.Fatalf("expected selected prefix id, got %q", got)
	}
}

func TestDocumentModelResolvedPreviewUsesSubdomainWhenPrefixSelected(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: configurator.DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		URLPrefixes: []configurator.DeploymentURLPrefix{
			{ID: "base-domain", Label: "Base Domain", Prefix: "https://example.com"},
		},
		Apps: []configurator.DeploymentApp{
			{
				AppID:             "client-interface",
				Name:              "Client Interface",
				Domain:            "example.com",
				Subdomain:         "owner.console",
				UIBaseURLPrefixID: "base-domain",
				AppType:           "client",
				Visibility:        "public",
			},
		},
	}

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepAppEditor
	model.appIndex = 0
	model.appInputs = model.newAppInputs()

	if got := model.renderResolvedAppPreview(); !strings.Contains(got, "https://owner.console.example.com") {
		t.Fatalf("expected resolved UI base URL preview, got %q", got)
	}
	if got := model.renderResolvedAppPreview(); !strings.Contains(got, "Resolved API") || !strings.Contains(got, "https://owner.console.example.com/api") {
		t.Fatalf("expected resolved API preview to follow resolved UI URL, got %q", got)
	}
}

func TestDocumentModelResetShortcutAppliesDerivedURLMode(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: configurator.DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		URLPrefixes: []configurator.DeploymentURLPrefix{
			{ID: "base-domain", Label: "Base Domain", Prefix: "https://example.com"},
		},
		Apps: []configurator.DeploymentApp{
			{
				AppID:      "client-interface",
				Name:       "Client Interface",
				Domain:     "example.com",
				Subdomain:  "app",
				UIBaseURL:  "https://manual.example.net",
				APIBaseURL: "https://manual.example.net/api",
				AppType:    "client",
				Visibility: "public",
			},
		},
	}

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepAppEditor
	model.appIndex = 0
	model.appInputs = model.newAppInputs()
	model.fieldCursor = 4
	model.appInputs[4].Focus()

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlR})
	m := updated.(Model)
	if got := m.appInputs[4].Value(); got != "" {
		t.Fatalf("expected UI full URL to clear, got %q", got)
	}
	if got := m.appInputs[6].Value(); got != "" {
		t.Fatalf("expected API full URL to clear, got %q", got)
	}
	if got := m.appInputs[5].Value(); got != "base-domain" {
		t.Fatalf("expected default prefix to be applied, got %q", got)
	}
	if m.fieldCursor != 3 {
		t.Fatalf("expected subdomain field to be focused, got %d", m.fieldCursor)
	}
}

func TestDocumentModelJumpMenuNavigatesToSection(t *testing.T) {
	doc := configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepApps

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlJ})
	m := updated.(Model)
	if m.step != stepJump {
		t.Fatalf("expected jump step, got %v", m.step)
	}

	m.cursor = 0
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m = updated.(Model)
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.step == stepJump {
		t.Fatal("expected jump selection to leave jump menu")
	}
}

func TestAppEditorAllowsLiteralOInputWithoutTogglingOAuth(t *testing.T) {
	doc := &configurator.DeploymentConfig{
		Version: "v1alpha1",
		Environment: configurator.DeploymentEnvironment{
			Name:        "demo",
			Namespace:   "demo",
			Targets:     []string{"compose"},
			ComposeMode: "image",
			Provider:    "vultr",
			Services:    []string{"gateway", "client-interface"},
		},
		Gateway: configurator.DeploymentGateway{
			PublicURL:     "https://gateway.example.com",
			PublicWSURL:   "wss://gateway.example.com",
			InternalURL:   "http://gateway:3000",
			InternalWSURL: "http://gateway:3300",
		},
		Apps: []configurator.DeploymentApp{
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

	model := NewDocumentModel(doc, "", nil, nil, nil, nil)
	model.step = stepAppEditor
	model.appIndex = 0
	model.appInputs = model.newAppInputs()
	model.appInputs[1].Focus()
	model.fieldCursor = 1

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'o'}})
	m := updated.(Model)
	if m.currentApp().OAuth != nil && m.currentApp().OAuth.Enabled {
		t.Fatal("expected literal o input to not toggle OAuth")
	}
	if got := m.appInputs[1].Value(); got == "Client Interface" {
		t.Fatalf("expected input value to change, got %q", got)
	}
}
