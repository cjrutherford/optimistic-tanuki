package tui

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

type Section string

const (
	SectionDeployment  Section = "Deployment"
	SectionProfile     Section = "Profile"
	SectionDatabases   Section = "Databases"
	SectionServices    Section = "Services"
	SectionImages      Section = "Images"
	SectionCompose     Section = "Compose"
	SectionKubernetes  Section = "Kubernetes"
	SectionSecrets     Section = "Secrets"
	SectionApply       Section = "Apply"
	SectionDiagnostics Section = "Diagnostics"
)

type generateFunc func() (configurator.GenerateResult, error)
type saveFunc func(*configurator.DeploymentConfig) error
type saveSecretsFunc func(map[string]string) error

type menuItem struct {
	Label    string
	Action   string
	Section  Section
	Disabled bool
}

type menu struct {
	Label string
	Items []menuItem
}

type Model struct {
	doc            *configurator.DeploymentConfig
	env            *domain.EnvironmentDefinition
	secrets        map[string]string
	deploymentPath string
	generate       generateFunc
	save           saveFunc
	saveSecrets    saveSecretsFunc
	catalog        *catalog.Catalog
	sections       []Section
	activeSection  Section
	menus          []menu
	activeMenu     int
	menuOpen       bool
	activeMenuItem int
	activeService  int
	activeSlot     int
	activeSecret   int
	result         configurator.GenerateResult
	err            error
	saveMessage    string
	diagnostics    []configurator.ValidationIssue
	help           map[Section]string

	application *tview.Application
	root        *tview.Flex
	menuBar     *tview.TextView
	navigation  *tview.List
	content     *tview.TextView
	helpView    *tview.TextView
	footer      *tview.TextView
	pages       *tview.Pages
}

func NewModel(env *domain.EnvironmentDefinition, generate generateFunc) *Model {
	doc := configurator.DeploymentConfigFromEnvironment(env)
	return NewDocumentModel(doc, "", nil, nil, generate, nil)
}

func NewDocumentModel(
	doc *configurator.DeploymentConfig,
	deploymentPath string,
	save saveFunc,
	saveSecrets saveSecretsFunc,
	generate generateFunc,
	secrets map[string]string,
) *Model {
	if doc == nil {
		doc = configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	}
	if secrets == nil {
		secrets = map[string]string{}
	}
	cat := catalog.DefaultCatalog()
	configurator.EnsureDeploymentDatabaseState(doc, cat)
	model := &Model{
		doc:            doc,
		secrets:        cloneMap(secrets),
		deploymentPath: deploymentPath,
		generate:       generate,
		save:           save,
		saveSecrets:    saveSecrets,
		catalog:        cat,
		sections: []Section{
			SectionDeployment,
			SectionProfile,
			SectionDatabases,
			SectionServices,
			SectionImages,
			SectionCompose,
			SectionKubernetes,
			SectionSecrets,
			SectionApply,
			SectionDiagnostics,
		},
		activeSection: SectionDeployment,
		help:          defaultHelpRegistry(),
	}
	model.menus = model.defaultMenus()
	model.syncEnv()
	model.refreshDiagnostics()
	return model
}

func (m *Model) Run() error {
	m.buildApplication()
	m.updateViews()
	return m.application.SetRoot(m.pages, true).EnableMouse(true).Run()
}

func (m *Model) View() string {
	parts := []string{
		m.renderMenuBar(),
		"Sections: " + strings.Join(m.sectionLabels(), " | "),
		"",
		m.renderContent(),
		"",
		"Help",
		m.CurrentHelp(),
	}
	return strings.Join(parts, "\n")
}

func (m *Model) ActiveSection() Section {
	return m.activeSection
}

func (m *Model) CurrentHelp() string {
	return m.help[m.activeSection]
}

func (m *Model) Menus() []string {
	labels := make([]string, 0, len(m.menus))
	for _, item := range m.menus {
		labels = append(labels, item.Label)
	}
	return labels
}

func (m *Model) MenuItems(index int) []string {
	if index < 0 || index >= len(m.menus) {
		return nil
	}
	labels := make([]string, 0, len(m.menus[index].Items))
	for _, item := range m.menus[index].Items {
		labels = append(labels, item.Label)
	}
	return labels
}

func (m *Model) ActivateSection(section Section) {
	for _, candidate := range m.sections {
		if candidate == section {
			m.activeSection = section
			break
		}
	}
	m.updateViews()
}

func (m *Model) OpenMenu(index int) {
	if len(m.menus) == 0 {
		return
	}
	m.activeMenu = (index + len(m.menus)) % len(m.menus)
	m.menuOpen = true
	m.activeMenuItem = 0
	m.updateViews()
}

func (m *Model) CloseMenu() {
	m.menuOpen = false
	m.activeMenuItem = 0
	m.updateViews()
}

func (m *Model) MoveMenu(delta int) {
	if len(m.menus) == 0 {
		return
	}
	m.activeMenu = (m.activeMenu + delta + len(m.menus)) % len(m.menus)
	m.activeMenuItem = 0
	m.updateViews()
}

func (m *Model) MoveMenuItem(delta int) {
	if !m.menuOpen || len(m.menus) == 0 || len(m.menus[m.activeMenu].Items) == 0 {
		return
	}
	items := m.menus[m.activeMenu].Items
	m.activeMenuItem = (m.activeMenuItem + delta + len(items)) % len(items)
	m.updateViews()
}

func (m *Model) SelectActiveMenuItem() {
	if !m.menuOpen || len(m.menus) == 0 || len(m.menus[m.activeMenu].Items) == 0 {
		m.OpenMenu(m.activeMenu)
		return
	}
	m.dispatchMenuItem(m.menus[m.activeMenu].Items[m.activeMenuItem])
	m.updateViews()
}

func (m *Model) SaveAll() error {
	m.syncEnv()
	if m.save != nil {
		if err := m.save(m.doc); err != nil {
			m.err = err
			m.saveMessage = "Save failed: " + err.Error()
			m.updateViews()
			return err
		}
	}
	if m.saveSecrets != nil {
		if err := m.saveSecrets(cloneMap(m.secrets)); err != nil {
			m.err = err
			m.saveMessage = "Secrets save failed: " + err.Error()
			m.updateViews()
			return err
		}
	}
	m.saveMessage = "Deployment files saved."
	m.err = nil
	m.refreshDiagnostics()
	m.updateViews()
	return nil
}

func (m *Model) Generate() error {
	m.syncEnv()
	if m.generate == nil {
		m.err = fmt.Errorf("generate action unavailable")
		m.updateViews()
		return m.err
	}
	result, err := m.generate()
	m.result = result
	m.err = err
	if err == nil {
		m.saveMessage = fmt.Sprintf("Generated %s", result.OutputDir)
	}
	m.refreshDiagnostics()
	m.updateViews()
	return err
}

func (m *Model) AddDatabaseSlot(slot configurator.DeploymentDatabaseSlot) {
	m.doc.Databases = append(m.doc.Databases, slot)
	configurator.EnsureDeploymentDatabaseState(m.doc, m.catalog)
	m.syncEnv()
	if len(m.doc.Databases) > 0 {
		m.activeSlot = len(m.doc.Databases) - 1
	}
	m.refreshDiagnostics()
	m.updateViews()
}

func (m *Model) DeleteActiveDatabaseSlot() bool {
	if len(m.doc.Databases) == 0 || m.activeSlot >= len(m.doc.Databases) {
		return false
	}
	removedID := m.doc.Databases[m.activeSlot].ID
	m.doc.Databases = append(m.doc.Databases[:m.activeSlot], m.doc.Databases[m.activeSlot+1:]...)
	for i := range m.doc.Services {
		if m.doc.Services[i].Database != nil && m.doc.Services[i].Database.SlotID == removedID {
			m.doc.Services[i].Database.SlotID = ""
		}
	}
	if m.activeSlot > 0 {
		m.activeSlot--
	}
	configurator.EnsureDeploymentDatabaseState(m.doc, m.catalog)
	m.syncEnv()
	m.refreshDiagnostics()
	m.updateViews()
	return true
}

func (m *Model) UpdateDatabaseSlot(index int, slot configurator.DeploymentDatabaseSlot) {
	if index < 0 || index >= len(m.doc.Databases) {
		return
	}
	m.doc.Databases[index] = slot
	configurator.EnsureDeploymentDatabaseState(m.doc, m.catalog)
	m.syncEnv()
	m.refreshDiagnostics()
	m.updateViews()
}

func (m *Model) ToggleServiceEnabled(serviceID string) {
	for i := range m.doc.Services {
		if m.doc.Services[i].ServiceID == serviceID {
			m.doc.Services[i].Enabled = !m.doc.Services[i].Enabled
			break
		}
	}
	configurator.EnsureDeploymentDatabaseState(m.doc, m.catalog)
	m.syncEnv()
	m.refreshDiagnostics()
	m.updateViews()
}

func (m *Model) UpdateService(service configurator.DeploymentService) {
	for i := range m.doc.Services {
		if m.doc.Services[i].ServiceID == service.ServiceID {
			m.doc.Services[i] = service
			break
		}
	}
	configurator.EnsureDeploymentDatabaseState(m.doc, m.catalog)
	m.syncEnv()
	m.refreshDiagnostics()
	m.updateViews()
}

func (m *Model) activeServiceConfig() *configurator.DeploymentService {
	if len(m.doc.Services) == 0 {
		return nil
	}
	if m.activeService >= len(m.doc.Services) {
		m.activeService = len(m.doc.Services) - 1
	}
	if m.activeService < 0 {
		m.activeService = 0
	}
	return &m.doc.Services[m.activeService]
}

func (m *Model) activeDatabaseSlot() *configurator.DeploymentDatabaseSlot {
	if len(m.doc.Databases) == 0 {
		return nil
	}
	if m.activeSlot >= len(m.doc.Databases) {
		m.activeSlot = len(m.doc.Databases) - 1
	}
	if m.activeSlot < 0 {
		m.activeSlot = 0
	}
	return &m.doc.Databases[m.activeSlot]
}

func (m *Model) buildApplication() {
	if m.application != nil {
		return
	}
	m.application = tview.NewApplication()
	m.pages = tview.NewPages()
	m.menuBar = tview.NewTextView().SetDynamicColors(true)
	m.navigation = tview.NewList().ShowSecondaryText(false)
	m.content = tview.NewTextView().SetDynamicColors(true).SetWrap(true)
	m.helpView = tview.NewTextView().SetDynamicColors(true).SetWrap(true)
	m.footer = tview.NewTextView().SetDynamicColors(true)

	for _, section := range m.sections {
		sectionCopy := section
		m.navigation.AddItem(string(section), "", 0, func() {
			m.ActivateSection(sectionCopy)
		})
	}
	m.navigation.SetChangedFunc(func(index int, mainText, _ string, _ rune) {
		if index >= 0 && index < len(m.sections) {
			m.activeSection = m.sections[index]
			m.updateViews()
		}
	})

	helpFrame := tview.NewFrame(m.helpView).SetBorders(1, 1, 1, 1, 0, 0).AddText("Contextual Help", true, tview.AlignLeft, tcell.ColorGreen)
	navFrame := tview.NewFrame(m.navigation).SetBorders(1, 1, 1, 1, 0, 0).AddText("Sections", true, tview.AlignLeft, tcell.ColorGreen)
	contentFrame := tview.NewFrame(m.content).SetBorders(1, 1, 1, 1, 0, 0).AddText("Document", true, tview.AlignLeft, tcell.ColorGreen)

	body := tview.NewFlex().
		AddItem(navFrame, 26, 1, true).
		AddItem(contentFrame, 0, 3, false).
		AddItem(helpFrame, 34, 1, false)

	m.root = tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(m.menuBar, 1, 0, false).
		AddItem(body, 0, 1, true).
		AddItem(m.footer, 2, 0, false)
	m.pages.AddPage("main", m.root, true, true)
	m.application.SetInputCapture(m.handleKey)
}

func (m *Model) handleKey(event *tcell.EventKey) *tcell.EventKey {
	if event.Key() == tcell.KeyCtrlC || event.Rune() == 'q' {
		m.application.Stop()
		return nil
	}
	if m.menuOpen {
		switch event.Key() {
		case tcell.KeyLeft:
			m.MoveMenu(-1)
			return nil
		case tcell.KeyRight:
			m.MoveMenu(1)
			return nil
		case tcell.KeyUp:
			m.MoveMenuItem(-1)
			return nil
		case tcell.KeyDown:
			m.MoveMenuItem(1)
			return nil
		case tcell.KeyEnter:
			m.SelectActiveMenuItem()
			return nil
		case tcell.KeyEsc:
			m.CloseMenu()
			return nil
		}
	}

	switch event.Key() {
	case tcell.KeyLeft:
		m.MoveMenu(-1)
		return nil
	case tcell.KeyRight:
		m.MoveMenu(1)
		return nil
	case tcell.KeyDown, tcell.KeyEnter:
		m.OpenMenu(m.activeMenu)
		return nil
	}

	switch event.Rune() {
	case 'e':
		m.openEditorForSection()
		return nil
	case 'a':
		if m.activeSection == SectionDatabases {
			m.openDatabaseEditor(-1)
			return nil
		}
	case 'd':
		if m.activeSection == SectionDatabases {
			m.showConfirmDeleteSlot()
			return nil
		}
	case 's':
		_ = m.SaveAll()
		return nil
	case 'g':
		_ = m.Generate()
		return nil
	case 'r':
		m.refreshDiagnostics()
		m.updateViews()
		return nil
	case ' ':
		if m.activeSection == SectionServices {
			if service := m.activeServiceConfig(); service != nil {
				m.ToggleServiceEnabled(service.ServiceID)
			}
			return nil
		}
	case 'j':
		m.advanceActiveRow(1)
		return nil
	case 'k':
		m.advanceActiveRow(-1)
		return nil
	}
	return event
}

func (m *Model) openEditorForSection() {
	switch m.activeSection {
	case SectionDeployment:
		m.openDeploymentEditor()
	case SectionDatabases:
		m.openDatabaseEditor(m.activeSlot)
	case SectionServices, SectionImages:
		m.openServiceEditor()
	case SectionSecrets:
		m.openSecretEditor()
	}
}

func (m *Model) openDeploymentEditor() {
	form := tview.NewForm()
	name := m.doc.Environment.Name
	namespace := m.doc.Environment.Namespace
	provider := m.doc.Environment.Provider
	composeMode := m.doc.Environment.ComposeMode
	targets := strings.Join(m.doc.Environment.Targets, ",")
	form.AddInputField("Name", name, 32, nil, func(text string) { name = text })
	form.AddInputField("Namespace", namespace, 32, nil, func(text string) { namespace = text })
	form.AddInputField("Targets", targets, 32, nil, func(text string) { targets = text })
	form.AddDropDown("Provider", []string{"akamai", "vultr", "oci"}, indexOf([]string{"akamai", "vultr", "oci"}, provider), func(option string, _ int) { provider = option })
	form.AddDropDown("Compose", []string{"build", "image"}, indexOf([]string{"build", "image"}, composeMode), func(option string, _ int) { composeMode = option })
	form.AddButton("Save", func() {
		m.doc.Environment.Name = strings.TrimSpace(name)
		m.doc.Environment.Namespace = strings.TrimSpace(namespace)
		m.doc.Environment.Provider = provider
		m.doc.Environment.ComposeMode = composeMode
		m.doc.Environment.Targets = splitCSV(targets)
		m.syncEnv()
		m.refreshDiagnostics()
		m.closeModal()
	})
	form.AddButton("Cancel", m.closeModal)
	m.showFormModal("Edit Deployment", form)
}

func (m *Model) openDatabaseEditor(index int) {
	current := configurator.DeploymentDatabaseSlot{ID: "postgres-primary", Infra: "postgres", ProvisionMode: "managed", Host: "db", Port: 5432, DatabaseName: m.doc.Environment.Name, Username: "postgres", PasswordKey: "POSTGRES_PASSWORD", Create: true, Migrate: true}
	if index >= 0 && index < len(m.doc.Databases) {
		current = m.doc.Databases[index]
	}
	form := tview.NewForm()
	id := current.ID
	infra := current.Infra
	provisionMode := current.ProvisionMode
	host := current.Host
	port := strconv.Itoa(current.Port)
	databaseName := current.DatabaseName
	username := current.Username
	passwordKey := current.PasswordKey
	create := current.Create
	migrate := current.Migrate
	seed := current.Seed
	form.AddInputField("ID", id, 32, nil, func(text string) { id = text })
	form.AddDropDown("Infra", []string{"postgres", "redis", "seaweedfs"}, indexOf([]string{"postgres", "redis", "seaweedfs"}, infra), func(option string, _ int) { infra = option })
	form.AddDropDown("Provision", []string{"managed", "external"}, indexOf([]string{"managed", "external"}, provisionMode), func(option string, _ int) { provisionMode = option })
	form.AddInputField("Host", host, 32, nil, func(text string) { host = text })
	form.AddInputField("Port", port, 8, nil, func(text string) { port = text })
	form.AddInputField("Database", databaseName, 32, nil, func(text string) { databaseName = text })
	form.AddInputField("Username", username, 32, nil, func(text string) { username = text })
	form.AddInputField("Password Key", passwordKey, 32, nil, func(text string) { passwordKey = text })
	form.AddCheckbox("Create", create, func(checked bool) { create = checked })
	form.AddCheckbox("Migrate", migrate, func(checked bool) { migrate = checked })
	form.AddCheckbox("Seed", seed, func(checked bool) { seed = checked })
	form.AddButton("Save", func() {
		parsedPort, _ := strconv.Atoi(strings.TrimSpace(port))
		slot := configurator.DeploymentDatabaseSlot{ID: strings.TrimSpace(id), Infra: infra, ProvisionMode: provisionMode, Host: strings.TrimSpace(host), Port: parsedPort, DatabaseName: strings.TrimSpace(databaseName), Username: strings.TrimSpace(username), PasswordKey: strings.TrimSpace(passwordKey), Create: create, Migrate: migrate, Seed: seed}
		if index >= 0 && index < len(m.doc.Databases) {
			m.UpdateDatabaseSlot(index, slot)
		} else {
			m.AddDatabaseSlot(slot)
		}
		m.closeModal()
	})
	form.AddButton("Cancel", m.closeModal)
	m.showFormModal("Edit Database Slot", form)
}

func (m *Model) openServiceEditor() {
	service := m.activeServiceConfig()
	if service == nil {
		return
	}
	form := tview.NewForm()
	enabled := service.Enabled
	replicas := strconv.Itoa(service.Replicas)
	imageTag := service.ImageTag
	slotOptions := []string{""}
	selectedSlot := 0
	for i, slot := range m.doc.Databases {
		slotOptions = append(slotOptions, slot.ID)
		if service.Database != nil && service.Database.SlotID == slot.ID {
			selectedSlot = i + 1
		}
	}
	databaseName := ""
	username := ""
	passwordKey := ""
	if service.Database != nil {
		databaseName = service.Database.DatabaseName
		username = service.Database.Username
		passwordKey = service.Database.PasswordKey
	}
	selectedSlotValue := ""
	if selectedSlot < len(slotOptions) {
		selectedSlotValue = slotOptions[selectedSlot]
	}
	form.AddTextView("Service", service.ServiceID, 32, 1, false, false)
	form.AddCheckbox("Enabled", enabled, func(checked bool) { enabled = checked })
	form.AddInputField("Replicas", replicas, 8, nil, func(text string) { replicas = text })
	form.AddInputField("Image Tag", imageTag, 24, nil, func(text string) { imageTag = text })
	form.AddDropDown("Database Slot", slotOptions, selectedSlot, func(option string, _ int) { selectedSlotValue = option })
	form.AddInputField("Database Name", databaseName, 32, nil, func(text string) { databaseName = text })
	form.AddInputField("Database User", username, 32, nil, func(text string) { username = text })
	form.AddInputField("Password Key", passwordKey, 32, nil, func(text string) { passwordKey = text })
	form.AddButton("Save", func() {
		parsedReplicas, _ := strconv.Atoi(strings.TrimSpace(replicas))
		updated := *service
		updated.Enabled = enabled
		updated.Replicas = parsedReplicas
		updated.ImageTag = strings.TrimSpace(imageTag)
		updated.Database = &configurator.DeploymentServiceDatabase{SlotID: strings.TrimSpace(selectedSlotValue), DatabaseName: strings.TrimSpace(databaseName), Username: strings.TrimSpace(username), PasswordKey: strings.TrimSpace(passwordKey)}
		m.UpdateService(updated)
		m.closeModal()
	})
	form.AddButton("Cancel", m.closeModal)
	m.showFormModal("Edit Service", form)
}

func (m *Model) openSecretEditor() {
	keys := sortedSecretKeys(m.secrets)
	if len(keys) == 0 {
		keys = []string{"JWT_SECRET"}
	}
	if m.activeSecret >= len(keys) {
		m.activeSecret = 0
	}
	key := keys[m.activeSecret]
	value := m.secrets[key]
	form := tview.NewForm()
	form.AddInputField("Key", key, 32, nil, func(text string) { key = text })
	form.AddInputField("Value", value, 48, nil, func(text string) { value = text })
	form.AddButton("Save", func() {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey != "" {
			m.secrets[trimmedKey] = value
		}
		m.refreshDiagnostics()
		m.closeModal()
		m.updateViews()
	})
	form.AddButton("Cancel", m.closeModal)
	m.showFormModal("Edit Secret", form)
}

func (m *Model) showConfirmDeleteSlot() {
	slot := m.activeDatabaseSlot()
	if slot == nil {
		return
	}
	modal := tview.NewModal().
		SetText(fmt.Sprintf("Delete database slot %s?", slot.ID)).
		AddButtons([]string{"Delete", "Cancel"}).
		SetDoneFunc(func(_ int, label string) {
			m.closeModal()
			if label == "Delete" {
				m.DeleteActiveDatabaseSlot()
			}
		})
	m.pages.AddPage("modal", center(60, 10, modal), true, true)
}

func (m *Model) showFormModal(title string, form *tview.Form) {
	form.SetBorder(true).SetTitle(" " + title + " ")
	m.pages.AddPage("modal", center(80, 24, form), true, true)
	m.application.SetFocus(form)
}

func (m *Model) closeModal() {
	m.pages.RemovePage("modal")
	m.application.SetFocus(m.navigation)
	m.updateViews()
}

func (m *Model) dispatchMenuItem(item menuItem) {
	if item.Disabled {
		return
	}
	switch item.Action {
	case "section":
		m.ActivateSection(item.Section)
	case "save":
		_ = m.SaveAll()
	case "generate":
		_ = m.Generate()
	case "edit":
		m.openEditorForSection()
	case "add-slot":
		m.openDatabaseEditor(-1)
	case "delete-slot":
		m.showConfirmDeleteSlot()
	case "refresh":
		m.refreshDiagnostics()
	case "quit":
		if m.application != nil {
			m.application.Stop()
		}
	}
	m.menuOpen = false
}

func (m *Model) syncEnv() {
	configurator.EnsureDeploymentDatabaseState(m.doc, m.catalog)
	m.env = m.doc.ToEnvironmentDefinition()
	m.env.Normalize()
}

func (m *Model) refreshDiagnostics() {
	m.syncEnv()
	m.diagnostics = configurator.ValidateDeploymentArtifacts(m.doc, m.secrets, m.catalog)
}

func (m *Model) updateViews() {
	if m.menuBar == nil {
		return
	}
	m.menuBar.SetText(m.renderMenuBar())
	for i, section := range m.sections {
		if section == m.activeSection {
			m.navigation.SetCurrentItem(i)
			break
		}
	}
	m.content.SetText(m.renderContent())
	m.helpView.SetText(m.CurrentHelp())
	m.footer.SetText(m.renderFooter())
}

func (m *Model) renderMenuBar() string {
	parts := make([]string, 0, len(m.menus))
	for i, menu := range m.menus {
		label := menu.Label
		if i == m.activeMenu {
			if m.menuOpen {
				label = fmt.Sprintf("[black:green] %s [-:-:-]", label)
			} else {
				label = fmt.Sprintf("[green::b] %s [-:-:-]", label)
			}
		}
		parts = append(parts, label)
	}
	if m.menuOpen && len(m.menus[m.activeMenu].Items) > 0 {
		items := make([]string, 0, len(m.menus[m.activeMenu].Items))
		for i, item := range m.menus[m.activeMenu].Items {
			label := item.Label
			if i == m.activeMenuItem {
				label = fmt.Sprintf("[black:yellow] %s [-:-:-]", label)
			}
			items = append(items, label)
		}
		return strings.Join(parts, "   ") + "\n" + strings.Join(items, "  ")
	}
	return strings.Join(parts, "   ")
}

func (m *Model) renderContent() string {
	switch m.activeSection {
	case SectionDeployment:
		return m.renderDeploymentDocument()
	case SectionProfile:
		return m.renderProfileDocument()
	case SectionDatabases:
		return m.renderDatabasesDocument()
	case SectionServices:
		return m.renderServicesDocument()
	case SectionImages:
		return m.renderImagesDocument()
	case SectionCompose:
		return m.renderComposeDocument()
	case SectionKubernetes:
		return m.renderKubernetesDocument()
	case SectionSecrets:
		return m.renderSecretsDocument()
	case SectionApply:
		return m.renderApplyDocument()
	case SectionDiagnostics:
		return m.renderDiagnosticsDocument()
	default:
		return ""
	}
}

func (m *Model) renderDeploymentDocument() string {
	workspacePath := fmt.Sprintf("dist/admin-env/%s", m.doc.Environment.Name)
	lines := []string{
		"[::b]Deployment[::-]",
		fmt.Sprintf("Name: %s", fallbackString(m.doc.Environment.Name, "(unnamed)")),
		fmt.Sprintf("Namespace: %s", fallbackString(m.doc.Environment.Namespace, "optimistic-tanuki")),
		fmt.Sprintf("Provider: %s", fallbackString(m.doc.Environment.Provider, "vultr")),
		fmt.Sprintf("Targets: %s", strings.Join(m.doc.Environment.Targets, ", ")),
		fmt.Sprintf("Compose mode: %s", fallbackString(m.doc.Environment.ComposeMode, "image")),
		fmt.Sprintf("Workspace: %s", workspacePath),
		fmt.Sprintf("Deployment file: %s", fallbackString(m.deploymentPath, workspacePath+"/deployment.yaml")),
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderProfileDocument() string {
	enabledServices := 0
	for _, service := range m.doc.Services {
		if service.Enabled {
			enabledServices++
		}
	}
	profileLabel := "balanced"
	if enabledServices <= 3 {
		profileLabel = "minimal"
	} else if enabledServices >= 12 {
		profileLabel = "full"
	} else {
		profileLabel = "small-server"
	}
	lines := []string{
		"[::b]Profile[::-]",
		fmt.Sprintf("Effective profile: %s", profileLabel),
		fmt.Sprintf("Enabled services: %d", enabledServices),
		fmt.Sprintf("Database slots: %d", len(m.doc.Databases)),
		fmt.Sprintf("Cold-start posture: %s", coldStartSummary(profileLabel)),
		fmt.Sprintf("Compose consequence: %s", composeSummary(m.doc.Environment.ComposeMode)),
		"This profile is descriptive today and reflects service density plus provider tuning.",
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderDatabasesDocument() string {
	report := configurator.BuildDatabaseReadiness(m.doc, m.catalog, m.secrets)
	lines := []string{"[::b]Databases[::-]"}
	if len(report.Slots) == 0 {
		lines = append(lines, "No database slots configured.")
		return strings.Join(lines, "\n")
	}
	for index, slot := range report.Slots {
		marker := "  "
		if index == m.activeSlot {
			marker = "> "
		}
		lines = append(lines,
			fmt.Sprintf("%s%s (%s) host=%s port=%d ready=%t", marker, slot.Slot.ID, slot.Slot.Infra, slot.Slot.Host, slot.Slot.Port, slot.Ready),
			fmt.Sprintf("   attached: %s", joinOrDefault(slot.AttachedServices, "none")),
			fmt.Sprintf("   db-setup: create=%t migrate=%t seed=%t", slot.Slot.Create, slot.Slot.Migrate, slot.Slot.Seed),
		)
		for _, warning := range slot.Warnings {
			lines = append(lines, "   warning: "+warning)
		}
	}
	if len(report.DBSetupSummaries) > 0 {
		lines = append(lines, "", "Future db-setup intent:")
		for _, summary := range report.DBSetupSummaries {
			lines = append(lines, "- "+summary)
		}
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderServicesDocument() string {
	report := configurator.BuildDatabaseReadiness(m.doc, m.catalog, m.secrets)
	bindingByService := map[string][]configurator.ResolvedServiceDatabaseBinding{}
	for _, binding := range report.ServiceBindings {
		bindingByService[binding.ServiceID] = append(bindingByService[binding.ServiceID], binding)
	}
	lines := []string{"[::b]Services[::-]"}
	for index, service := range m.doc.Services {
		marker := "  "
		if index == m.activeService {
			marker = "> "
		}
		preset, _ := m.catalog.Get(service.ServiceID)
		effectiveTag := fallbackString(service.ImageTag, m.doc.Environment.DefaultTag)
		lines = append(lines, fmt.Sprintf("%s%s enabled=%t replicas=%d imageTag=%s", marker, service.ServiceID, service.Enabled, service.Replicas, effectiveTag))
		if len(preset.Dependencies) > 0 {
			requires := make([]string, 0, len(preset.Dependencies))
			for _, dep := range preset.Dependencies {
				requires = append(requires, dep.ServiceID)
			}
			lines = append(lines, "   required infra/services: "+strings.Join(requires, ", "))
		}
		for _, binding := range bindingByService[service.ServiceID] {
			mode := "override"
			if binding.Inherited {
				mode = "inherit"
			}
			lines = append(lines, fmt.Sprintf("   database %s via %s slot=%s db=%s user=%s", mode, binding.Infra, binding.SlotID, binding.DatabaseName, binding.Username))
		}
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderImagesDocument() string {
	lines := []string{"[::b]Images[::-]", fmt.Sprintf("Default tag: %s", fallbackString(m.doc.Environment.DefaultTag, "latest"))}
	for _, service := range m.doc.Services {
		lines = append(lines, fmt.Sprintf("- %s => %s", service.ServiceID, fallbackString(service.ImageTag, "inherits default tag")))
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderComposeDocument() string {
	enabled := contains(m.doc.Environment.Targets, "compose")
	lines := []string{
		"[::b]Compose[::-]",
		fmt.Sprintf("Enabled: %t", enabled),
		fmt.Sprintf("Mode: %s", fallbackString(m.doc.Environment.ComposeMode, "image")),
		fmt.Sprintf("Workspace file: dist/admin-env/%s/compose/docker-compose.yaml", m.doc.Environment.Name),
		fmt.Sprintf("Disabled services: %d", countDisabledServices(m.doc.Services)),
		"Generation uses resolved database-slot bindings for service env output.",
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderKubernetesDocument() string {
	enabled := contains(m.doc.Environment.Targets, "k8s")
	lines := []string{
		"[::b]Kubernetes[::-]",
		fmt.Sprintf("Enabled: %t", enabled),
		fmt.Sprintf("Namespace: %s", fallbackString(m.doc.Environment.Namespace, "optimistic-tanuki")),
		fmt.Sprintf("Workspace path: dist/admin-env/%s/k8s", m.doc.Environment.Name),
		"Generated manifests consume the same slot-resolution model as Compose.",
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderSecretsDocument() string {
	keys := sortedSecretKeys(m.secrets)
	lines := []string{"[::b]Secrets[::-]", fmt.Sprintf("Configured keys: %d", len(keys))}
	for i, key := range keys {
		marker := "  "
		if i == m.activeSecret {
			marker = "> "
		}
		lines = append(lines, fmt.Sprintf("%s%s", marker, key))
	}
	if len(keys) == 0 {
		lines = append(lines, "No secrets stored yet. Press e to create one.")
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderApplyDocument() string {
	lines := []string{
		"[::b]Apply[::-]",
		"- Save persists deployment.yaml and secrets when paths are configured.",
		"- Generate materializes compose, k8s, runtime env, registry, validation, and db-setup files.",
		"- Refresh reruns diagnostics against the current in-memory document.",
	}
	if m.result.OutputDir != "" {
		lines = append(lines, "", fmt.Sprintf("Last generation: %s", m.result.OutputDir))
		if m.result.DatabaseSetupPath != "" {
			lines = append(lines, fmt.Sprintf("db-setup plan: %s/%s", m.result.OutputDir, m.result.DatabaseSetupPath))
		}
	}
	if m.saveMessage != "" {
		lines = append(lines, "", m.saveMessage)
	}
	if m.err != nil {
		lines = append(lines, "", "Last error: "+m.err.Error())
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderDiagnosticsDocument() string {
	lines := []string{"[::b]Diagnostics[::-]"}
	if len(m.diagnostics) == 0 {
		lines = append(lines, "No validation issues found.")
		return strings.Join(lines, "\n")
	}
	groups := groupedDiagnostics(m.diagnostics)
	keys := make([]string, 0, len(groups))
	for key := range groups {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		lines = append(lines, "", key)
		for _, issue := range groups[key] {
			lines = append(lines, fmt.Sprintf("- [%s] %s", issue.Severity, issue.Message))
		}
	}
	return strings.Join(lines, "\n")
}

func (m *Model) renderFooter() string {
	return "[green]Keys[::-] Left/Right menus  Enter opens/selects  e edit  a add slot  d delete slot  j/k move row  space toggle service  s save  g generate  r refresh  q quit"
}

func (m *Model) sectionLabels() []string {
	labels := make([]string, 0, len(m.sections))
	for _, section := range m.sections {
		labels = append(labels, string(section))
	}
	return labels
}

func (m *Model) defaultMenus() []menu {
	navigationItems := make([]menuItem, 0, len(m.sections))
	for _, section := range m.sections {
		navigationItems = append(navigationItems, menuItem{Label: string(section), Action: "section", Section: section})
	}
	return []menu{
		{Label: "File", Items: []menuItem{{Label: "Save", Action: "save"}, {Label: "Generate", Action: "generate"}, {Label: "Quit", Action: "quit"}}},
		{Label: "Navigate", Items: navigationItems},
		{Label: "Edit", Items: []menuItem{{Label: "Edit current document", Action: "edit"}, {Label: "Add database slot", Action: "add-slot"}, {Label: "Delete active slot", Action: "delete-slot"}}},
		{Label: "Diagnostics", Items: []menuItem{{Label: "Refresh diagnostics", Action: "refresh"}, {Label: string(SectionDiagnostics), Action: "section", Section: SectionDiagnostics}}},
	}
}

func (m *Model) advanceActiveRow(delta int) {
	switch m.activeSection {
	case SectionDatabases:
		if len(m.doc.Databases) > 0 {
			m.activeSlot = (m.activeSlot + delta + len(m.doc.Databases)) % len(m.doc.Databases)
		}
	case SectionServices, SectionImages:
		if len(m.doc.Services) > 0 {
			m.activeService = (m.activeService + delta + len(m.doc.Services)) % len(m.doc.Services)
		}
	case SectionSecrets:
		keys := sortedSecretKeys(m.secrets)
		if len(keys) > 0 {
			m.activeSecret = (m.activeSecret + delta + len(keys)) % len(keys)
		}
	}
	m.updateViews()
}

func defaultHelpRegistry() map[Section]string {
	return map[Section]string{
		SectionDeployment:  "Deployment controls workspace identity, namespace, provider, and target surfaces. Edit here before regenerating the workspace so every derived file lands under the expected dist/admin-env deployment path.",
		SectionProfile:     "Profile summarizes startup weight and workspace intent. Use it to understand whether the current deployment behaves more like a minimal, small-server, or full footprint before you widen service scope.",
		SectionDatabases:   "Databases define deployment-level slots. Prefer services to inherit one shared managed slot per infra kind and only switch a service to another slot when it truly diverges. Lifecycle flags describe future db-setup intent for create, migrate, and seed work.",
		SectionServices:    "Services show the effective deployment view. Inherit a database slot when the service can share deployment intent; override only when the service needs a different slot, database name, or password key. The document also surfaces image and replica consequences.",
		SectionImages:      "Images show workspace-wide image intent. Leave service tags empty to inherit the deployment default tag and set an override only when one service must move independently.",
		SectionCompose:     "Compose explains the generated docker-compose output, startup mode, and how many services stay enabled. Database-slot resolution is already folded into the generated runtime env and compose service environment.",
		SectionKubernetes:  "Kubernetes summarizes namespace and generated workspace output. The same resolved slot model is used for manifest env wiring so Compose and k8s stay aligned.",
		SectionSecrets:     "Secrets list the current key/value backend used by validation and generation. Keep password keys aligned with database slots and service overrides so regeneration can materialize the correct runtime env.",
		SectionApply:       "Apply describes the operator actions. Save persists the document, Generate rewrites the workspace artifacts, and Refresh reruns validation without mutating files.",
		SectionDiagnostics: "Diagnostics groups warnings by category so you can decide whether to regenerate, refresh, or fix deployment intent first. Database warnings usually mean a missing slot, secret key, or mismatched override.",
	}
}

func groupedDiagnostics(issues []configurator.ValidationIssue) map[string][]configurator.ValidationIssue {
	groups := map[string][]configurator.ValidationIssue{}
	for _, issue := range issues {
		group := "general"
		switch {
		case strings.Contains(issue.Message, "database") || strings.Contains(issue.Message, "POSTGRES") || strings.Contains(issue.Message, "REDIS"):
			group = "database"
		case strings.Contains(issue.Message, "gateway"):
			group = "gateway"
		case strings.Contains(issue.Message, "oauth"):
			group = "oauth"
		case strings.Contains(issue.Message, "app "):
			group = "apps"
		}
		groups[group] = append(groups[group], issue)
	}
	return groups
}

func center(width, height int, primitive tview.Primitive) tview.Primitive {
	return tview.NewFlex().
		AddItem(nil, 0, 1, false).
		AddItem(tview.NewFlex().SetDirection(tview.FlexRow).
			AddItem(nil, 0, 1, false).
			AddItem(primitive, height, 1, true).
			AddItem(nil, 0, 1, false), width, 1, true).
		AddItem(nil, 0, 1, false)
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func cloneMap(values map[string]string) map[string]string {
	result := make(map[string]string, len(values))
	for key, value := range values {
		result[key] = value
	}
	return result
}

func sortedSecretKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func joinOrDefault(values []string, fallback string) string {
	if len(values) == 0 {
		return fallback
	}
	return strings.Join(values, ", ")
}

func fallbackString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func countDisabledServices(services []configurator.DeploymentService) int {
	count := 0
	for _, service := range services {
		if !service.Enabled {
			count++
		}
	}
	return count
}

func composeSummary(mode string) string {
	if mode == "build" {
		return "builds images from source when generating local workspaces"
	}
	return "pulls published images by tag during deploy"
}

func coldStartSummary(profile string) string {
	switch profile {
	case "minimal":
		return "low startup cost with the smallest enabled set"
	case "full":
		return "highest startup cost with most services enabled"
	default:
		return "moderate startup cost tuned for shared deployments"
	}
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func indexOf(values []string, target string) int {
	for i, value := range values {
		if value == target {
			return i
		}
	}
	return 0
}
