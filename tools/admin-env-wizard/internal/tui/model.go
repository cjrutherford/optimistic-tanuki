package tui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

type step int

const (
	stepBasics step = iota
	stepTargets
	stepComposeMode
	stepInfra
	stepServices
	stepGateway
	stepSecrets
	stepSecretEditor
	stepPrefixes
	stepPrefixEditor
	stepApps
	stepAppEditor
	stepJump
	stepReview
	stepResult
)

type generateFunc func() (configurator.GenerateResult, error)
type saveFunc func(*configurator.DeploymentConfig) error
type saveSecretsFunc func(map[string]string) error

type generateDoneMsg struct {
	result configurator.GenerateResult
	err    error
}

type saveDoneMsg struct {
	err error
}

type option struct {
	label    string
	selected bool
}

type Model struct {
	step               step
	returnStep         step
	env                *domain.EnvironmentDefinition
	doc                *configurator.DeploymentConfig
	secrets            map[string]string
	deploymentPath     string
	inputs             []textinput.Model
	gatewayInputs      []textinput.Model
	prefixInputs       []textinput.Model
	appInputs          []textinput.Model
	secretInput        textinput.Model
	targets            []option
	infra              []option
	services           []option
	secretKeys         []string
	cursor             int
	fieldCursor        int
	listOffset         int
	appIndex           int
	prefixIndex        int
	prefixPickerOpen   bool
	prefixPickerCursor int
	selectedSecret     string
	generate           generateFunc
	save               saveFunc
	saveSecrets        saveSecretsFunc
	result             configurator.GenerateResult
	err                error
	saveMessage        string
	loading            bool
	saving             bool
	width              int
	height             int
	sidebarWidth       int
}

func NewModel(env *domain.EnvironmentDefinition, generate generateFunc) Model {
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
) Model {
	if doc == nil {
		doc = configurator.DeploymentConfigFromEnvironment(configurator.DefaultEnvironment())
	}
	if secrets == nil {
		secrets = map[string]string{}
	}

	env := doc.ToEnvironmentDefinition()
	env.Normalize()

	model := Model{
		step:           stepBasics,
		env:            env,
		doc:            doc,
		secrets:        secrets,
		deploymentPath: deploymentPath,
		sidebarWidth:   28,
		targets: []option{
			{label: string(domain.TargetCompose), selected: true},
			{label: string(domain.TargetK8s), selected: true},
		},
		infra: optionsFromInfra(
			[]domain.InfraKind{domain.InfraPostgres, domain.InfraRedis, domain.InfraSeaweedFS},
			env.IncludeInfra,
		),
		services: optionsFromServices(
			[]string{
				"gateway", "authentication", "profile", "social", "app-configurator", "system-configurator-api",
				"chat-collector", "assets", "ai-orchestration", "prompt-proxy", "telos-docs-service", "blogging",
				"permissions", "project-planning", "forum", "wellness", "classifieds", "payments", "store",
				"lead-tracker", "finance", "client-interface", "forgeofwill", "digital-homestead", "hai",
				"christopherrutherford-net", "owner-console", "fin-commander", "marketing-generator", "store-client", "configurable-client",
				"system-configurator", "d6", "local-hub", "leads-app", "video-client",
			},
			env.Services,
		),
		generate:    generate,
		save:        save,
		saveSecrets: saveSecrets,
	}

	model.syncOptionsFromDoc()
	model.inputs = model.newBasicsInputs()
	model.gatewayInputs = model.newGatewayInputs()
	model.appInputs = model.newAppInputs()
	model.secretKeys = model.buildSecretKeys()
	model.secretInput = textinput.New()
	model.secretInput.Prompt = "Value: "
	model.inputs[0].Focus()

	return model
}

func (m Model) Init() tea.Cmd { return textinput.Blink }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case generateDoneMsg:
		m.loading = false
		m.result = msg.result
		m.err = msg.err
		if msg.err == nil {
			m.step = stepResult
		}
		return m, nil
	case saveDoneMsg:
		m.saving = false
		if msg.err != nil {
			m.saveMessage = "Save failed: " + msg.err.Error()
		} else {
			m.saveMessage = "Deployment files saved."
		}
		return m, nil
	case tea.MouseMsg:
		return m.updateMouse(msg)
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "ctrl+j":
			if m.step != stepJump {
				m.returnStep = m.step
				m.cursor = 0
				m.step = stepJump
				return m, nil
			}
		case "ctrl+n":
			return m.goRelativeStep(1), nil
		case "ctrl+p":
			return m.goRelativeStep(-1), nil
		}

		switch m.step {
		case stepBasics:
			return m.updateTextInputs(msg, &m.inputs, stepTargets, m.syncBasics)
		case stepTargets:
			return m.updateOptions(msg, &m.targets, stepComposeMode)
		case stepComposeMode:
			return m.updateComposeMode(msg)
		case stepInfra:
			return m.updateOptions(msg, &m.infra, stepServices)
		case stepServices:
			return m.updateOptions(msg, &m.services, stepGateway)
		case stepGateway:
			return m.updateTextInputs(msg, &m.gatewayInputs, stepSecrets, m.syncGateway)
		case stepSecrets:
			return m.updateSecrets(msg)
		case stepSecretEditor:
			return m.updateSecretEditor(msg)
		case stepPrefixes:
			return m.updatePrefixes(msg)
		case stepPrefixEditor:
			return m.updatePrefixEditor(msg)
		case stepApps:
			return m.updateApps(msg)
		case stepAppEditor:
			return m.updateAppEditor(msg)
		case stepJump:
			return m.updateJump(msg)
		case stepReview:
			return m.updateReview(msg)
		case stepResult:
			if msg.String() == "r" {
				m.step = stepBasics
			}
		}
	}
	return m, nil
}

func (m Model) View() string {
	content := m.renderContent()
	return m.renderShell(content)
}

func (m Model) renderContent() string {
	title := lipgloss.NewStyle().Bold(true).Render("Admin Env Wizard")
	header := title + "\n" + m.renderBreadcrumbs()
	switch m.step {
	case stepBasics:
		lines := []string{header, "", "Deployment Basics", ""}
		for _, input := range m.inputs {
			lines = append(lines, input.View())
		}
		lines = append(lines, "", "Tab navigates, Enter continues, Ctrl+J opens jump menu")
		return strings.Join(lines, "\n")
	case stepTargets:
		return header + "\n\nSelect targets\n\n" + renderOptions(m.targets, m.cursor) + "\n\nSpace toggles, Enter continues"
	case stepComposeMode:
		mode := m.doc.Environment.ComposeMode
		if mode == "" {
			mode = string(domain.ComposeModeImage)
		}
		return fmt.Sprintf("%s\n\nCompose Mode\n\nCurrent: %s\n\nPress b for build, i for image, Enter continues", header, mode)
	case stepInfra:
		return header + "\n\nSelect infra\n\n" + renderOptions(m.infra, m.cursor) + "\n\nSpace toggles, Enter continues"
	case stepServices:
		return header + "\n\nSelect services\n\n" + renderOptions(m.services, m.cursor) + "\n\nSpace toggles, a selects all, n clears all, Enter continues"
	case stepGateway:
		lines := []string{header, "", "Gateway URLs", ""}
		for _, input := range m.gatewayInputs {
			lines = append(lines, input.View())
		}
		lines = append(lines, "", "Tab navigates, Enter continues")
		return strings.Join(lines, "\n")
	case stepSecrets:
		return header + "\n\nSecrets Mapping\n\n" + m.renderSecretsTable() + "\n\nEnter continues, e edits selected secret, Ctrl+S saves files, Ctrl+N/P steps, Ctrl+J jumps"
	case stepSecretEditor:
		return header + "\n\nEdit Secret\n\nKey: " + m.selectedSecret + "\n\n" + m.secretInput.View() + "\n\nCtrl+S saves value, Esc returns"
	case stepPrefixes:
		return header + "\n\nURL Prefixes\n\n" + m.renderPrefixesTable() + "\n\nEnter edits, a adds prefix, d deletes prefix, right opens apps, Ctrl+S saves files"
	case stepPrefixEditor:
		lines := []string{header, "", fmt.Sprintf("Edit Prefix %d", m.prefixIndex+1), ""}
		for _, input := range m.prefixInputs {
			lines = append(lines, input.View())
		}
		lines = append(lines, "", "Tab navigates, Ctrl+S saves prefix, Esc returns")
		return strings.Join(lines, "\n")
	case stepApps:
		return header + "\n\nRegistry Apps\n\n" + m.renderAppsTable() + "\n\nu manages URL prefixes, a adds client app, d deletes app, Enter edits, Ctrl+S saves files"
	case stepAppEditor:
		lines := []string{header, "", fmt.Sprintf("Edit App %d", m.appIndex+1), ""}
		for _, input := range m.appInputs {
			lines = append(lines, input.View())
		}
		oauthEnabled := "no"
		if m.currentApp().OAuth != nil && m.currentApp().OAuth.Enabled {
			oauthEnabled = "yes"
		}
		lines = append(lines, "", "OAuth enabled: "+oauthEnabled)
		if m.isPrefixSelectionField() {
			lines = append(lines, "", "URL Prefix Picker", m.renderPrefixSelectionTable())
		}
		lines = append(lines, m.renderResolvedAppPreview())
		lines = append(lines, "Tab navigates, Enter opens prefix picker, Up/Down choose, Ctrl+R resets to derived URLs and focuses subdomain, Ctrl+S saves app, Ctrl+O toggles OAuth, Esc returns")
		return strings.Join(lines, "\n")
	case stepJump:
		return header + "\n\nJump To Section\n\n" + m.renderJumpTable() + "\n\nUp/Down selects, Enter jumps, Esc returns"
	case stepReview:
		status := ""
		if m.saveMessage != "" {
			status = "\n\n" + m.saveMessage
		}
		return header + "\n\nReview\n\n" + m.reviewSummary() + status + "\n\nPress g to generate, Ctrl+S to save files, Ctrl+J to jump"
	case stepResult:
		if m.err != nil {
			return header + "\n\nGeneration failed:\n" + m.err.Error()
		}
		return fmt.Sprintf(
			"%s\n\nGenerated output in %s\nCompose: %s\nK8s: %s\nRegistry: %s\nRuntime env: %s\n\nPress q to quit",
			header,
			m.result.OutputDir,
			m.result.ComposePath,
			m.result.K8sPath,
			m.result.RegistryPath,
			m.result.RuntimeEnvPath,
		)
	default:
		return header
	}
}

func (m Model) renderShell(content string) string {
	sidebarStyle := lipgloss.NewStyle().
		Width(m.sidebarWidth).
		Padding(1, 1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63"))
	contentWidth := max(44, m.width-m.sidebarWidth-5)
	contentStyle := lipgloss.NewStyle().
		Width(contentWidth).
		Padding(1, 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("240"))
	footerStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("245")).
		Padding(0, 1)

	sidebar := sidebarStyle.Render(m.renderSidebar())
	body := contentStyle.Render(content)
	footer := footerStyle.Render("Mouse: click sections or table rows, wheel scroll lists. Keys: Ctrl+J jump, Ctrl+N/P next/prev, Ctrl+S save.")
	return lipgloss.JoinVertical(lipgloss.Left, lipgloss.JoinHorizontal(lipgloss.Top, sidebar, body), footer)
}

func (m Model) renderSidebar() string {
	lines := []string{"Deployment", fallbackString(m.doc.Environment.Name, "(unnamed)"), ""}
	for _, item := range m.navigableSteps() {
		prefix := "  "
		if item == m.step {
			prefix = "> "
		}
		lines = append(lines, prefix+stepLabel(item))
	}
	lines = append(lines, "", "Status")
	if m.saving {
		lines = append(lines, "saving...")
	} else if m.loading {
		lines = append(lines, "generating...")
	} else if m.saveMessage != "" {
		lines = append(lines, m.saveMessage)
	} else {
		lines = append(lines, "ready")
	}
	return strings.Join(lines, "\n")
}

func (m Model) updateTextInputs(
	msg tea.KeyMsg,
	inputs *[]textinput.Model,
	next step,
	onAdvance func(*Model),
) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEnter:
		if onAdvance != nil {
			onAdvance(&m)
		}
		m.cursor = 0
		m.listOffset = 0
		m.fieldCursor = 0
		m.step = next
		if next == stepSecrets {
			m.secretKeys = m.buildSecretKeys()
		}
		return m, nil
	case tea.KeyTab, tea.KeyShiftTab, tea.KeyUp, tea.KeyDown:
		if msg.Type == tea.KeyUp || msg.Type == tea.KeyShiftTab {
			m.fieldCursor = (m.fieldCursor + len(*inputs) - 1) % len(*inputs)
		} else {
			m.fieldCursor = (m.fieldCursor + 1) % len(*inputs)
		}
		for i := range *inputs {
			if i == m.fieldCursor {
				(*inputs)[i].Focus()
			} else {
				(*inputs)[i].Blur()
			}
		}
		return m, nil
	}

	cmds := make([]tea.Cmd, len(*inputs))
	for i := range *inputs {
		(*inputs)[i], cmds[i] = (*inputs)[i].Update(msg)
	}
	return m, tea.Batch(cmds...)
}

func (m Model) updateOptions(msg tea.KeyMsg, opts *[]option, next step) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up":
		m.cursor = (m.cursor + len(*opts) - 1) % len(*opts)
	case "down":
		m.cursor = (m.cursor + 1) % len(*opts)
	case " ":
		(*opts)[m.cursor].selected = !(*opts)[m.cursor].selected
	case "a":
		if m.step == stepServices {
			for i := range *opts {
				(*opts)[i].selected = true
			}
		}
	case "n":
		if m.step == stepServices {
			for i := range *opts {
				(*opts)[i].selected = false
			}
		}
	case "enter":
		m.syncEnv()
		m.cursor = 0
		m.listOffset = 0
		m.step = next
		if next == stepGateway {
			m.gatewayInputs = m.newGatewayInputs()
			m.gatewayInputs[0].Focus()
			m.fieldCursor = 0
		}
	}
	return m, nil
}

func (m Model) updateComposeMode(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "b":
		m.doc.Environment.ComposeMode = string(domain.ComposeModeBuild)
	case "i":
		m.doc.Environment.ComposeMode = string(domain.ComposeModeImage)
	case "enter":
		m.env.ComposeMode = domain.ComposeMode(m.doc.Environment.ComposeMode)
		m.listOffset = 0
		m.step = stepInfra
	}
	return m, nil
}

func (m Model) updateSecrets(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up":
		if len(m.secretKeys) > 0 {
			m.cursor = (m.cursor + len(m.secretKeys) - 1) % len(m.secretKeys)
			m.ensureCursorVisible(len(m.secretKeys))
		}
	case "down":
		if len(m.secretKeys) > 0 {
			m.cursor = (m.cursor + 1) % len(m.secretKeys)
			m.ensureCursorVisible(len(m.secretKeys))
		}
	case "enter":
		m.cursor = 0
		m.listOffset = 0
		m.step = stepPrefixes
	case "e":
		if len(m.secretKeys) == 0 {
			m.step = stepPrefixes
			return m, nil
		}
		m.selectedSecret = m.secretKeys[m.cursor]
		m.secretInput = textinput.New()
		m.secretInput.Prompt = "Value: "
		m.secretInput.SetValue(m.secrets[m.selectedSecret])
		m.secretInput.Focus()
		m.step = stepSecretEditor
	case "ctrl+s":
		return m.saveAll()
	case "b":
		m.step = stepGateway
	}
	return m, nil
}

func (m Model) updateSecretEditor(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEsc:
		m.step = stepSecrets
		return m, nil
	case tea.KeyCtrlS:
		m.secrets[m.selectedSecret] = m.secretInput.Value()
		m.secretKeys = m.buildSecretKeys()
		m.step = stepSecrets
		return m, nil
	}

	var cmd tea.Cmd
	m.secretInput, cmd = m.secretInput.Update(msg)
	return m, cmd
}

func (m Model) updatePrefixes(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up":
		if len(m.doc.URLPrefixes) > 0 {
			m.cursor = (m.cursor + len(m.doc.URLPrefixes) - 1) % len(m.doc.URLPrefixes)
			m.ensureCursorVisible(len(m.doc.URLPrefixes))
		}
	case "down":
		if len(m.doc.URLPrefixes) > 0 {
			m.cursor = (m.cursor + 1) % len(m.doc.URLPrefixes)
			m.ensureCursorVisible(len(m.doc.URLPrefixes))
		}
	case "a", "ctrl+a":
		m.doc.URLPrefixes = append(m.doc.URLPrefixes, configurator.DeploymentURLPrefix{
			ID:     fmt.Sprintf("prefix-%d", len(m.doc.URLPrefixes)+1),
			Label:  fmt.Sprintf("Prefix %d", len(m.doc.URLPrefixes)+1),
			Prefix: "https://",
		})
		m.cursor = len(m.doc.URLPrefixes) - 1
		m.ensureCursorVisible(len(m.doc.URLPrefixes))
	case "d", "ctrl+d":
		if len(m.doc.URLPrefixes) > 0 {
			m.doc.URLPrefixes = append(m.doc.URLPrefixes[:m.cursor], m.doc.URLPrefixes[m.cursor+1:]...)
			if m.cursor >= len(m.doc.URLPrefixes) && m.cursor > 0 {
				m.cursor--
			}
			m.ensureCursorVisible(len(m.doc.URLPrefixes))
		}
	case "ctrl+s":
		return m.saveAll()
	case "right", "l":
		m.cursor = 0
		m.listOffset = 0
		m.step = stepApps
	case "enter":
		if len(m.doc.URLPrefixes) == 0 {
			m.doc.URLPrefixes = append(m.doc.URLPrefixes, configurator.DeploymentURLPrefix{
				ID:     "prefix-1",
				Label:  "Prefix 1",
				Prefix: "https://",
			})
			m.cursor = 0
		}
		m.prefixIndex = m.cursor
		m.prefixInputs = m.newPrefixInputs()
		m.prefixInputs[0].Focus()
		m.fieldCursor = 0
		m.step = stepPrefixEditor
	case "b":
		m.step = stepSecrets
	}
	return m, nil
}

func (m Model) updatePrefixEditor(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEsc:
		m.step = stepPrefixes
		return m, nil
	case tea.KeyCtrlS:
		m.syncCurrentPrefix()
		m.step = stepPrefixes
		return m, nil
	case tea.KeyTab, tea.KeyShiftTab, tea.KeyUp, tea.KeyDown:
		if msg.Type == tea.KeyUp || msg.Type == tea.KeyShiftTab {
			m.fieldCursor = (m.fieldCursor + len(m.prefixInputs) - 1) % len(m.prefixInputs)
		} else {
			m.fieldCursor = (m.fieldCursor + 1) % len(m.prefixInputs)
		}
		for i := range m.prefixInputs {
			if i == m.fieldCursor {
				m.prefixInputs[i].Focus()
			} else {
				m.prefixInputs[i].Blur()
			}
		}
		return m, nil
	}

	cmds := make([]tea.Cmd, len(m.prefixInputs))
	for i := range m.prefixInputs {
		m.prefixInputs[i], cmds[i] = m.prefixInputs[i].Update(msg)
	}
	return m, tea.Batch(cmds...)
}

func (m Model) updateApps(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up":
		if len(m.doc.Apps) > 0 {
			m.cursor = (m.cursor + len(m.doc.Apps) - 1) % len(m.doc.Apps)
			m.ensureCursorVisible(len(m.doc.Apps))
		}
	case "down":
		if len(m.doc.Apps) > 0 {
			m.cursor = (m.cursor + 1) % len(m.doc.Apps)
			m.ensureCursorVisible(len(m.doc.Apps))
		}
	case "a", "ctrl+a":
		m.addRegistryApp()
	case "d", "ctrl+d":
		if len(m.doc.Apps) > 0 {
			m.doc.Apps = append(m.doc.Apps[:m.cursor], m.doc.Apps[m.cursor+1:]...)
			if m.cursor >= len(m.doc.Apps) && m.cursor > 0 {
				m.cursor--
			}
			m.ensureCursorVisible(len(m.doc.Apps))
		}
	case "ctrl+s":
		return m.saveAll()
	case "u":
		m.cursor = 0
		m.listOffset = 0
		m.step = stepPrefixes
	case "g":
		m.cursor = 0
		m.listOffset = 0
		m.step = stepReview
	case "enter":
		if len(m.doc.Apps) > 0 {
			m.appIndex = m.cursor
			m.appInputs = m.newAppInputs()
			m.appInputs[0].Focus()
			m.fieldCursor = 0
			m.step = stepAppEditor
		}
	case "b":
		m.step = stepPrefixes
	}
	return m, nil
}

func (m Model) updateAppEditor(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEsc:
		if m.prefixPickerOpen {
			m.prefixPickerOpen = false
			return m, nil
		}
		m.step = stepApps
		return m, nil
	case tea.KeyCtrlS:
		m.prefixPickerOpen = false
		m.syncCurrentApp()
		m.step = stepApps
		return m, nil
	case tea.KeyCtrlO:
		app := m.currentApp()
		if app.OAuth == nil {
			app.OAuth = &configurator.DeploymentAppOAuth{Enabled: true}
		} else {
			app.OAuth.Enabled = !app.OAuth.Enabled
		}
		return m, nil
	case tea.KeyCtrlR:
		m.resetCurrentAppToDerivedURLs()
		return m, nil
	case tea.KeyRunes:
		if len(msg.Runes) == 1 {
			switch msg.Runes[0] {
			case '[':
				m.cycleCurrentPrefixField(-1)
				return m, nil
			case ']':
				m.cycleCurrentPrefixField(1)
				return m, nil
			}
		}
	case tea.KeyEnter:
		if m.isPrefixSelectionField() {
			if m.prefixPickerOpen {
				m.applyPrefixPickerSelection()
			} else {
				m.openPrefixPicker()
			}
			return m, nil
		}
	case tea.KeyUp, tea.KeyDown:
		if m.prefixPickerOpen {
			delta := 1
			if msg.Type == tea.KeyUp {
				delta = -1
			}
			m.movePrefixPicker(delta)
			return m, nil
		}
		fallthrough
	case tea.KeyTab, tea.KeyShiftTab:
		m.prefixPickerOpen = false
		if msg.Type == tea.KeyUp || msg.Type == tea.KeyShiftTab {
			m.fieldCursor = (m.fieldCursor + len(m.appInputs) - 1) % len(m.appInputs)
		} else {
			m.fieldCursor = (m.fieldCursor + 1) % len(m.appInputs)
		}
		for i := range m.appInputs {
			if i == m.fieldCursor {
				m.appInputs[i].Focus()
			} else {
				m.appInputs[i].Blur()
			}
		}
		return m, nil
	}

	if m.prefixPickerOpen && m.isPrefixSelectionField() {
		return m, nil
	}
	if m.isPrefixSelectionField() {
		return m, nil
	}
	cmds := make([]tea.Cmd, len(m.appInputs))
	for i := range m.appInputs {
		m.appInputs[i], cmds[i] = m.appInputs[i].Update(msg)
	}
	return m, tea.Batch(cmds...)
}

func (m Model) updateJump(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	steps := m.navigableSteps()
	switch msg.Type {
	case tea.KeyEsc:
		m.step = m.returnStep
		m.listOffset = 0
		return m, nil
	case tea.KeyEnter:
		return m.navigateToStep(steps[m.cursor]), nil
	}

	switch msg.String() {
	case "up":
		m.cursor = (m.cursor + len(steps) - 1) % len(steps)
		m.ensureCursorVisible(len(steps))
	case "down":
		m.cursor = (m.cursor + 1) % len(steps)
		m.ensureCursorVisible(len(steps))
	}
	return m, nil
}

func (m Model) updateReview(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "g":
		if !m.loading && m.generate != nil {
			m.loading = true
			m.syncBasics(&m)
			m.syncGateway(&m)
			return m, func() tea.Msg {
				result, err := m.generate()
				return generateDoneMsg{result: result, err: err}
			}
		}
	case "ctrl+s":
		return m.saveAll()
	case "b":
		m.step = stepApps
	}
	return m, nil
}

func (m Model) updateMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	if msg.Action != tea.MouseActionPress {
		return m, nil
	}
	if tea.MouseEvent(msg).IsWheel() {
		switch m.step {
		case stepTargets, stepInfra, stepServices, stepSecrets, stepPrefixes, stepApps, stepJump, stepAppEditor:
			if msg.Button == tea.MouseButtonWheelUp {
				return m.handleListMove(-1), nil
			}
			if msg.Button == tea.MouseButtonWheelDown {
				return m.handleListMove(1), nil
			}
		}
	}
	if msg.Button == tea.MouseButtonLeft && msg.X < m.sidebarWidth+4 {
		if target, ok := m.sidebarStepAt(msg.Y); ok {
			return m.navigateToStep(target), nil
		}
	}
	if msg.Button != tea.MouseButtonLeft || msg.X < m.sidebarWidth+4 {
		return m, nil
	}
	switch m.step {
	case stepSecrets:
		if row, ok := m.contentRowAt(msg.Y, len(m.secretKeys)); ok {
			m.cursor = row
			if len(m.secretKeys) > 0 {
				m.selectedSecret = m.secretKeys[m.cursor]
				m.secretInput = textinput.New()
				m.secretInput.Prompt = "Value: "
				m.secretInput.SetValue(m.secrets[m.selectedSecret])
				m.secretInput.Focus()
				m.step = stepSecretEditor
			}
		}
	case stepPrefixes:
		if row, ok := m.contentRowAt(msg.Y, len(m.doc.URLPrefixes)); ok {
			m.cursor = row
			if len(m.doc.URLPrefixes) > 0 {
				m.prefixIndex = m.cursor
				m.prefixInputs = m.newPrefixInputs()
				m.prefixInputs[0].Focus()
				m.fieldCursor = 0
				m.step = stepPrefixEditor
			}
		}
	case stepApps:
		if row, ok := m.contentRowAt(msg.Y, len(m.doc.Apps)); ok {
			m.cursor = row
			if len(m.doc.Apps) > 0 {
				m.appIndex = m.cursor
				m.appInputs = m.newAppInputs()
				m.appInputs[0].Focus()
				m.fieldCursor = 0
				m.step = stepAppEditor
			}
		}
	case stepJump:
		if row, ok := m.contentRowAt(msg.Y, len(m.navigableSteps())); ok {
			m.cursor = row
			steps := m.navigableSteps()
			m = m.navigateToStep(steps[m.cursor])
		}
	case stepAppEditor:
		if !m.isPrefixSelectionField() {
			return m, nil
		}
		if row, ok := m.appEditorPrefixRowAt(msg.Y); ok {
			ids := m.prefixSelectionIDs()
			if row >= 0 && row < len(ids) {
				m.prefixPickerOpen = true
				m.prefixPickerCursor = row
				m.applyPrefixPickerSelection()
			}
		}
	}
	return m, nil
}

func (m *Model) syncBasics(_ *Model) {
	m.doc.Environment.Name = m.inputs[0].Value()
	m.doc.Environment.Namespace = m.inputs[1].Value()
	m.doc.Environment.ImageOwner = m.inputs[2].Value()
	m.doc.Environment.DefaultTag = m.inputs[3].Value()
	m.env.Name = m.doc.Environment.Name
	m.env.Namespace = m.doc.Environment.Namespace
	m.env.ImageOwner = m.doc.Environment.ImageOwner
	m.env.DefaultTag = m.doc.Environment.DefaultTag
}

func (m *Model) syncGateway(_ *Model) {
	m.doc.Gateway.PublicURL = m.gatewayInputs[0].Value()
	m.doc.Gateway.PublicWSURL = m.gatewayInputs[1].Value()
	m.doc.Gateway.InternalURL = m.gatewayInputs[2].Value()
	m.doc.Gateway.InternalWSURL = m.gatewayInputs[3].Value()
}

func (m *Model) syncEnv() {
	m.doc.Environment.Targets = nil
	m.env.Targets = nil
	for _, opt := range m.targets {
		if opt.selected {
			m.doc.Environment.Targets = append(m.doc.Environment.Targets, opt.label)
			m.env.Targets = append(m.env.Targets, domain.Target(opt.label))
		}
	}

	m.doc.Environment.Infra = nil
	m.env.IncludeInfra = nil
	for _, opt := range m.infra {
		if opt.selected {
			m.doc.Environment.Infra = append(m.doc.Environment.Infra, opt.label)
			m.env.IncludeInfra = append(m.env.IncludeInfra, domain.InfraKind(opt.label))
		}
	}

	m.doc.Environment.Services = nil
	m.env.Services = nil
	selectedClients := map[string]struct{}{}
	for _, opt := range m.services {
		if opt.selected {
			m.doc.Environment.Services = append(m.doc.Environment.Services, opt.label)
			m.env.Services = append(m.env.Services, domain.ServiceSelection{ServiceID: opt.label, Enabled: true})
			if preset, ok := catalog.DefaultCatalog().Get(opt.label); ok && preset.Category == catalog.CategoryClient {
				selectedClients[opt.label] = struct{}{}
			}
		}
	}

	filteredApps := make([]configurator.DeploymentApp, 0, len(m.doc.Apps))
	for _, app := range m.doc.Apps {
		if _, keep := selectedClients[app.AppID]; keep {
			filteredApps = append(filteredApps, app)
		}
	}
	m.doc.Apps = filteredApps
	for clientID := range selectedClients {
		if !m.hasApp(clientID) {
			m.doc.Apps = append(m.doc.Apps, defaultApp(clientID))
		}
	}
}

func (m *Model) syncStepState(step step) {
	switch step {
	case stepBasics:
		m.syncBasics(m)
	case stepTargets, stepInfra, stepServices:
		m.syncEnv()
	case stepGateway:
		m.syncGateway(m)
	case stepPrefixEditor:
		m.syncCurrentPrefix()
	case stepAppEditor:
		m.syncCurrentApp()
	case stepSecretEditor:
		m.secrets[m.selectedSecret] = m.secretInput.Value()
		m.secretKeys = m.buildSecretKeys()
	}
}

func (m *Model) syncPendingState() {
	stepToSync := m.step
	if m.step == stepJump {
		stepToSync = m.returnStep
	}
	m.syncStepState(stepToSync)
}

func (m Model) reviewSummary() string {
	rows := [][]string{
		{"Name", m.doc.Environment.Name},
		{"Namespace", m.doc.Environment.Namespace},
		{"Image Owner", m.doc.Environment.ImageOwner},
		{"Default Tag", m.doc.Environment.DefaultTag},
		{"Targets", strings.Join(m.doc.Environment.Targets, ", ")},
		{"Compose Mode", m.doc.Environment.ComposeMode},
		{"Infra", strings.Join(m.doc.Environment.Infra, ", ")},
		{"Services", fmt.Sprintf("%d selected", len(m.doc.Environment.Services))},
		{"Gateway", m.doc.Gateway.PublicURL},
		{"Secrets", fmt.Sprintf("%d mapped", len(m.secretKeys))},
		{"URL Prefixes", fmt.Sprintf("%d", len(m.doc.URLPrefixes))},
		{"Registry Apps", fmt.Sprintf("%d", len(m.doc.Apps))},
		{"Document", fallbackString(m.deploymentPath, "(unsaved document)")},
	}
	return renderTable([]string{"Field", "Value"}, rows)
}

func (m Model) renderSecretsTable() string {
	start, end := m.visibleRange(len(m.secretKeys))
	rows := make([][]string, 0, max(1, end-start))
	for index := start; index < end; index++ {
		key := m.secretKeys[index]
		value := m.secrets[key]
		status := "set"
		masked := maskSecretValue(value)
		if strings.TrimSpace(value) == "" {
			status = "blank"
			masked = "(blank)"
		}
		prefix := " "
		if index == m.cursor {
			prefix = ">"
		}
		rows = append(rows, []string{prefix, key, status, masked})
	}
	if len(rows) == 0 {
		rows = append(rows, []string{" ", "(none)", "", ""})
	}
	return renderTable([]string{"", "Secret Key", "Status", "Value"}, rows) + "\n" + m.renderTableWindowStatus(len(m.secretKeys))
}

func (m Model) renderPrefixesTable() string {
	start, end := m.visibleRange(len(m.doc.URLPrefixes))
	rows := make([][]string, 0, max(1, end-start))
	for index := start; index < end; index++ {
		prefixValue := m.doc.URLPrefixes[index]
		prefix := " "
		if index == m.cursor {
			prefix = ">"
		}
		rows = append(rows, []string{prefix, prefixValue.ID, fallbackString(prefixValue.Label, prefixValue.ID), prefixValue.Prefix})
	}
	if len(rows) == 0 {
		rows = append(rows, []string{" ", "(none)", "", ""})
	}
	return renderTable([]string{"", "ID", "Label", "Prefix"}, rows) + "\n" + m.renderTableWindowStatus(len(m.doc.URLPrefixes))
}

func (m Model) renderAppsTable() string {
	start, end := m.visibleRange(len(m.doc.Apps))
	rows := make([][]string, 0, max(1, end-start))
	for index := start; index < end; index++ {
		app := m.doc.Apps[index]
		prefix := " "
		if index == m.cursor {
			prefix = ">"
		}
		oauthEnabled := "no"
		if app.OAuth != nil && app.OAuth.Enabled {
			oauthEnabled = "yes"
		}
		rows = append(rows, []string{
			prefix,
			app.AppID,
			app.Domain,
			resolvedAppURL(m.doc, app, true),
			app.AppType,
			oauthEnabled,
		})
	}
	if len(rows) == 0 {
		rows = append(rows, []string{" ", "(none)", "", "", "", ""})
	}
	return renderTable([]string{"", "App ID", "Domain", "UI Base URL", "Type", "OAuth"}, rows) + "\n" + m.renderTableWindowStatus(len(m.doc.Apps))
}

func (m Model) renderPrefixSelectionTable() string {
	rows := make([][]string, 0, len(m.doc.URLPrefixes)+1)
	selectedID := ""
	if m.isPrefixSelectionField() {
		selectedID = m.appInputs[m.fieldCursor].Value()
	}
	rows = append(rows, []string{m.prefixPickerMarker(0, selectedID == ""), "(none)", "Use explicit full URL"})
	for index, prefix := range m.doc.URLPrefixes {
		rows = append(rows, []string{
			m.prefixPickerMarker(index+1, selectedID == prefix.ID),
			prefix.ID,
			prefix.Prefix,
		})
	}
	return renderTable([]string{"", "Prefix ID", "Prefix"}, rows)
}

func (m Model) renderResolvedAppPreview() string {
	app := *m.currentApp()
	app.Domain = m.appInputs[2].Value()
	app.Subdomain = m.appInputs[3].Value()
	app.UIBaseURL = m.appInputs[4].Value()
	app.UIBaseURLPrefixID = m.appInputs[5].Value()
	app.APIBaseURL = m.appInputs[6].Value()

	rows := [][]string{
		{"Host", appHost(app.Domain, app.Subdomain)},
		{"Resolved UI", resolvedAppURL(m.doc, app, true)},
		{"Resolved API", resolvedAppURL(m.doc, app, false)},
	}
	return renderTable([]string{"Field", "Value"}, rows)
}

func (m Model) renderJumpTable() string {
	steps := m.navigableSteps()
	start, end := m.visibleRange(len(steps))
	rows := make([][]string, 0, max(1, end-start))
	for index := start; index < end; index++ {
		item := steps[index]
		prefix := " "
		if index == m.cursor {
			prefix = ">"
		}
		rows = append(rows, []string{prefix, fmt.Sprintf("%d", index+1), stepLabel(item)})
	}
	return renderTable([]string{"", "#", "Section"}, rows) + "\n" + m.renderTableWindowStatus(len(steps))
}

func renderTable(headers []string, rows [][]string) string {
	widths := make([]int, len(headers))
	for i, header := range headers {
		widths[i] = len(header)
	}
	for _, row := range rows {
		for i := range headers {
			if i < len(row) && len(row[i]) > widths[i] {
				widths[i] = len(row[i])
			}
		}
	}
	var builder strings.Builder
	writeRow := func(row []string) {
		for i := range headers {
			value := ""
			if i < len(row) {
				value = row[i]
			}
			builder.WriteString(padRight(value, widths[i]))
			if i < len(headers)-1 {
				builder.WriteString("  ")
			}
		}
		builder.WriteString("\n")
	}
	writeRow(headers)
	separators := make([]string, len(headers))
	for i, width := range widths {
		separators[i] = strings.Repeat("-", width)
	}
	writeRow(separators)
	for _, row := range rows {
		writeRow(row)
	}
	return strings.TrimRight(builder.String(), "\n")
}

func renderOptions(opts []option, cursor int) string {
	lines := make([]string, 0, len(opts))
	for i, opt := range opts {
		prefix := "  "
		if i == cursor {
			prefix = "> "
		}
		check := "[ ]"
		if opt.selected {
			check = "[x]"
		}
		lines = append(lines, prefix+check+" "+opt.label)
	}
	return strings.Join(lines, "\n")
}

func optionsFromInfra(all []domain.InfraKind, enabled []domain.InfraKind) []option {
	selected := map[domain.InfraKind]bool{}
	for _, item := range enabled {
		selected[item] = true
	}
	out := make([]option, 0, len(all))
	for _, item := range all {
		out = append(out, option{label: string(item), selected: selected[item]})
	}
	return out
}

func optionsFromServices(all []string, enabled []domain.ServiceSelection) []option {
	selected := map[string]bool{}
	for _, item := range enabled {
		selected[item.ServiceID] = item.Enabled
	}
	out := make([]option, 0, len(all))
	for _, item := range all {
		out = append(out, option{label: item, selected: selected[item]})
	}
	return out
}

func (m *Model) syncOptionsFromDoc() {
	targetSelected := map[string]bool{}
	for _, target := range m.doc.Environment.Targets {
		targetSelected[target] = true
	}
	for i := range m.targets {
		m.targets[i].selected = targetSelected[m.targets[i].label]
	}

	infraSelected := map[string]bool{}
	for _, infra := range m.doc.Environment.Infra {
		infraSelected[infra] = true
	}
	for i := range m.infra {
		m.infra[i].selected = infraSelected[m.infra[i].label]
	}

	serviceSelected := map[string]bool{}
	for _, service := range m.doc.Environment.Services {
		serviceSelected[service] = true
	}
	for i := range m.services {
		m.services[i].selected = serviceSelected[m.services[i].label]
	}
}

func (m Model) newBasicsInputs() []textinput.Model {
	values := []string{
		m.doc.Environment.Name,
		m.doc.Environment.Namespace,
		m.doc.Environment.ImageOwner,
		m.doc.Environment.DefaultTag,
	}
	prompts := []string{"Name: ", "Namespace: ", "Image Owner: ", "Default Tag: "}
	inputs := make([]textinput.Model, len(prompts))
	for i := range inputs {
		inputs[i] = textinput.New()
		inputs[i].Prompt = prompts[i]
		inputs[i].SetValue(values[i])
	}
	return inputs
}

func (m Model) newGatewayInputs() []textinput.Model {
	values := []string{
		m.doc.Gateway.PublicURL,
		m.doc.Gateway.PublicWSURL,
		m.doc.Gateway.InternalURL,
		m.doc.Gateway.InternalWSURL,
	}
	prompts := []string{"Public URL: ", "Public WS URL: ", "Internal URL: ", "Internal WS URL: "}
	inputs := make([]textinput.Model, len(prompts))
	for i := range inputs {
		inputs[i] = textinput.New()
		inputs[i].Prompt = prompts[i]
		inputs[i].SetValue(values[i])
	}
	return inputs
}

func (m Model) newPrefixInputs() []textinput.Model {
	prefix := m.currentPrefix()
	values := []string{
		prefix.ID,
		prefix.Label,
		prefix.Prefix,
	}
	prompts := []string{"Prefix ID: ", "Label: ", "Prefix: "}
	inputs := make([]textinput.Model, len(prompts))
	for i := range inputs {
		inputs[i] = textinput.New()
		inputs[i].Prompt = prompts[i]
		inputs[i].SetValue(values[i])
	}
	return inputs
}

func (m Model) newAppInputs() []textinput.Model {
	app := m.currentAppValue()
	values := []string{
		app.AppID,
		app.Name,
		app.Domain,
		app.Subdomain,
		app.UIBaseURL,
		app.UIBaseURLPrefixID,
		app.APIBaseURL,
		app.AppType,
		app.Visibility,
	}
	prompts := []string{
		"App ID: ",
		"Name: ",
		"Domain: ",
		"Subdomain: ",
		"UI Full URL: ",
		"UI Base Domain: ",
		"API Full URL: ",
		"App Type: ",
		"Visibility: ",
	}
	inputs := make([]textinput.Model, len(prompts))
	for i := range inputs {
		inputs[i] = textinput.New()
		inputs[i].Prompt = prompts[i]
		inputs[i].SetValue(values[i])
	}
	return inputs
}

func (m *Model) currentPrefix() *configurator.DeploymentURLPrefix {
	if len(m.doc.URLPrefixes) == 0 {
		m.doc.URLPrefixes = append(m.doc.URLPrefixes, configurator.DeploymentURLPrefix{
			ID:     "https-root",
			Label:  "HTTPS Root",
			Prefix: "https://",
		})
	}
	if m.prefixIndex >= len(m.doc.URLPrefixes) {
		m.prefixIndex = len(m.doc.URLPrefixes) - 1
	}
	if m.prefixIndex < 0 {
		m.prefixIndex = 0
	}
	return &m.doc.URLPrefixes[m.prefixIndex]
}

func (m *Model) currentApp() *configurator.DeploymentApp {
	if len(m.doc.Apps) == 0 {
		m.doc.Apps = append(m.doc.Apps, m.currentAppValue())
	}
	if m.appIndex >= len(m.doc.Apps) {
		m.appIndex = len(m.doc.Apps) - 1
	}
	if m.appIndex < 0 {
		m.appIndex = 0
	}
	return &m.doc.Apps[m.appIndex]
}

func (m Model) currentAppValue() configurator.DeploymentApp {
	if len(m.doc.Apps) > 0 {
		index := m.appIndex
		if index >= len(m.doc.Apps) {
			index = len(m.doc.Apps) - 1
		}
		if index < 0 {
			index = 0
		}
		return m.doc.Apps[index]
	}
	selectedClients := m.selectedClientServices()
	if len(selectedClients) > 0 {
		return defaultApp(selectedClients[0])
	}
	return defaultApp("client-interface")
}

func (m *Model) syncCurrentPrefix() {
	prefix := m.currentPrefix()
	prefix.ID = m.prefixInputs[0].Value()
	prefix.Label = m.prefixInputs[1].Value()
	prefix.Prefix = m.prefixInputs[2].Value()
}

func (m *Model) syncCurrentApp() {
	app := m.currentApp()
	app.AppID = m.appInputs[0].Value()
	app.Name = m.appInputs[1].Value()
	app.Domain = m.appInputs[2].Value()
	app.Subdomain = m.appInputs[3].Value()
	app.UIBaseURL = m.appInputs[4].Value()
	app.UIBaseURLPrefixID = m.appInputs[5].Value()
	app.APIBaseURL = m.appInputs[6].Value()
	app.AppType = m.appInputs[7].Value()
	app.Visibility = m.appInputs[8].Value()
}

func (m *Model) resetCurrentAppToDerivedURLs() {
	if len(m.doc.URLPrefixes) > 0 {
		currentPrefix := strings.TrimSpace(m.appInputs[5].Value())
		if currentPrefix == "" {
			m.appInputs[5].SetValue(strings.TrimSpace(m.doc.URLPrefixes[0].ID))
		}
	}
	m.appInputs[4].SetValue("")
	m.appInputs[6].SetValue("")
	m.prefixPickerOpen = false
	m.fieldCursor = 3
	for i := range m.appInputs {
		if i == m.fieldCursor {
			m.appInputs[i].Focus()
		} else {
			m.appInputs[i].Blur()
		}
	}
}

func (m *Model) addRegistryApp() {
	selectedClients := m.selectedClientServices()
	for _, clientID := range selectedClients {
		if !m.hasApp(clientID) {
			m.doc.Apps = append(m.doc.Apps, defaultApp(clientID))
			m.cursor = len(m.doc.Apps) - 1
			return
		}
	}
	m.doc.Apps = append(m.doc.Apps, defaultApp(fmt.Sprintf("client-%d", len(m.doc.Apps)+1)))
	m.cursor = len(m.doc.Apps) - 1
}

func (m Model) selectedClientServices() []string {
	cat := catalog.DefaultCatalog()
	clients := make([]string, 0)
	for _, serviceID := range m.doc.Environment.Services {
		preset, ok := cat.Get(serviceID)
		if ok && preset.Category == catalog.CategoryClient {
			clients = append(clients, serviceID)
		}
	}
	return clients
}

func (m Model) hasApp(appID string) bool {
	for _, app := range m.doc.Apps {
		if app.AppID == appID {
			return true
		}
	}
	return false
}

func defaultApp(appID string) configurator.DeploymentApp {
	name := appID
	domainName := appID + ".example.com"
	return configurator.DeploymentApp{
		AppID:      appID,
		Name:       name,
		Domain:     domainName,
		UIBaseURL:  "https://" + domainName,
		APIBaseURL: "https://gateway.example.com/api",
		AppType:    "client",
		Visibility: "public",
	}
}

func fallbackString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func padRight(value string, width int) string {
	if len(value) >= width {
		return value
	}
	return value + strings.Repeat(" ", width-len(value))
}

func maskSecretValue(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	if len(value) <= 4 {
		return strings.Repeat("*", len(value))
	}
	return strings.Repeat("*", len(value)-4) + value[len(value)-4:]
}

func (m Model) buildSecretKeys() []string {
	keys := []string{"PRODUCTION_IMAGE_TAG", "JWT_SECRET", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "REDIS_PASSWORD"}
	for _, provider := range []string{"google", "github", "microsoft", "facebook"} {
		if config, ok := m.doc.OAuth.Providers[provider]; ok {
			if strings.TrimSpace(config.ClientIDKey) != "" {
				keys = append(keys, config.ClientIDKey)
			}
			if strings.TrimSpace(config.ClientSecretKey) != "" {
				keys = append(keys, config.ClientSecretKey)
			}
		}
	}
	unique := map[string]struct{}{}
	out := make([]string, 0, len(keys))
	for _, key := range keys {
		if _, seen := unique[key]; seen || strings.TrimSpace(key) == "" {
			continue
		}
		unique[key] = struct{}{}
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}

func (m Model) renderBreadcrumbs() string {
	parts := make([]string, 0, len(m.navigableSteps()))
	for _, item := range m.navigableSteps() {
		label := stepLabel(item)
		if item == m.step {
			label = "[" + label + "]"
		}
		parts = append(parts, label)
	}
	return strings.Join(parts, " > ")
}

func stepLabel(s step) string {
	switch s {
	case stepBasics:
		return "Basics"
	case stepTargets:
		return "Targets"
	case stepComposeMode:
		return "Compose"
	case stepInfra:
		return "Infra"
	case stepServices:
		return "Services"
	case stepGateway:
		return "Gateway"
	case stepSecrets:
		return "Secrets"
	case stepPrefixes:
		return "URL Prefixes"
	case stepApps:
		return "Registry"
	case stepReview:
		return "Review"
	case stepResult:
		return "Result"
	default:
		return "Editor"
	}
}

func (m Model) navigableSteps() []step {
	return []step{stepBasics, stepTargets, stepComposeMode, stepInfra, stepServices, stepGateway, stepSecrets, stepPrefixes, stepApps, stepReview}
}

func (m Model) goRelativeStep(delta int) Model {
	m.syncPendingState()
	steps := m.navigableSteps()
	index := 0
	for i, item := range steps {
		if item == m.step {
			index = i
			break
		}
	}
	index = (index + delta + len(steps)) % len(steps)
	m.step = steps[index]
	m.cursor = 0
	m.listOffset = 0
	m.fieldCursor = 0
	return m
}

func (m Model) navigateToStep(target step) Model {
	m.syncPendingState()
	m.step = target
	m.cursor = 0
	m.listOffset = 0
	m.fieldCursor = 0
	return m
}

func (m Model) saveAll() (tea.Model, tea.Cmd) {
	m.syncPendingState()
	m.secretKeys = m.buildSecretKeys()
	m.saving = true
	return m, func() tea.Msg {
		if m.save != nil {
			if err := m.save(m.doc); err != nil {
				return saveDoneMsg{err: err}
			}
		}
		if m.saveSecrets != nil {
			if err := m.saveSecrets(m.secrets); err != nil {
				return saveDoneMsg{err: err}
			}
		}
		if m.save == nil && m.saveSecrets == nil {
			return saveDoneMsg{err: fmt.Errorf("no save targets configured")}
		}
		return saveDoneMsg{}
	}
}

func (m Model) handleListMove(delta int) Model {
	limit := 0
	switch m.step {
	case stepTargets:
		limit = len(m.targets)
	case stepInfra:
		limit = len(m.infra)
	case stepServices:
		limit = len(m.services)
	case stepSecrets:
		limit = len(m.secretKeys)
	case stepPrefixes:
		limit = len(m.doc.URLPrefixes)
	case stepApps:
		limit = len(m.doc.Apps)
	case stepJump:
		limit = len(m.navigableSteps())
	case stepAppEditor:
		if m.isPrefixSelectionField() {
			limit = len(m.prefixSelectionIDs())
		}
	}
	if limit == 0 {
		return m
	}
	if m.step == stepAppEditor && m.isPrefixSelectionField() {
		m.prefixPickerOpen = true
		m.prefixPickerCursor = (m.prefixPickerCursor + delta + limit) % limit
		return m
	}
	m.cursor = (m.cursor + delta + limit) % limit
	m.ensureCursorVisible(limit)
	return m
}

func (m Model) sidebarStepAt(y int) (step, bool) {
	line := y - 4
	steps := m.navigableSteps()
	if line >= 0 && line < len(steps) {
		return steps[line], true
	}
	return stepBasics, false
}

func (m *Model) cycleCurrentPrefixField(delta int) {
	if !m.isPrefixSelectionField() {
		return
	}
	ids := m.prefixSelectionIDs()
	if len(ids) == 0 {
		return
	}
	current := m.appInputs[m.fieldCursor].Value()
	index := 0
	for i, id := range ids {
		if id == current {
			index = i
			break
		}
	}
	index = (index + delta + len(ids)) % len(ids)
	m.appInputs[m.fieldCursor].SetValue(ids[index])
}

func (m *Model) openPrefixPicker() {
	ids := m.prefixSelectionIDs()
	current := m.appInputs[m.fieldCursor].Value()
	m.prefixPickerCursor = 0
	for i, id := range ids {
		if id == current {
			m.prefixPickerCursor = i
			break
		}
	}
	m.prefixPickerOpen = true
}

func (m *Model) movePrefixPicker(delta int) {
	ids := m.prefixSelectionIDs()
	if len(ids) == 0 {
		return
	}
	m.prefixPickerCursor = (m.prefixPickerCursor + delta + len(ids)) % len(ids)
}

func (m *Model) applyPrefixPickerSelection() {
	ids := m.prefixSelectionIDs()
	if len(ids) == 0 {
		m.prefixPickerOpen = false
		return
	}
	if m.prefixPickerCursor < 0 {
		m.prefixPickerCursor = 0
	}
	if m.prefixPickerCursor >= len(ids) {
		m.prefixPickerCursor = len(ids) - 1
	}
	m.appInputs[m.fieldCursor].SetValue(ids[m.prefixPickerCursor])
	m.prefixPickerOpen = false
}

func (m Model) prefixSelectionIDs() []string {
	ids := make([]string, 0, len(m.doc.URLPrefixes)+1)
	ids = append(ids, "")
	for _, prefix := range m.doc.URLPrefixes {
		ids = append(ids, prefix.ID)
	}
	return ids
}

func (m Model) isPrefixSelectionField() bool {
	return m.fieldCursor == 5
}

func (m Model) prefixPickerMarker(index int, selected bool) string {
	marker := " "
	if selected {
		marker = "*"
	}
	if m.prefixPickerOpen && index == m.prefixPickerCursor {
		if selected {
			return ">"
		}
		return ">"
	}
	return marker
}

func (m *Model) ensureCursorVisible(total int) {
	if total <= 0 {
		m.listOffset = 0
		return
	}
	visible := m.listPageSize()
	if visible <= 0 {
		visible = total
	}
	if m.cursor < m.listOffset {
		m.listOffset = m.cursor
	}
	if m.cursor >= m.listOffset+visible {
		m.listOffset = m.cursor - visible + 1
	}
	maxOffset := max(0, total-visible)
	if m.listOffset > maxOffset {
		m.listOffset = maxOffset
	}
}

func (m Model) visibleRange(total int) (int, int) {
	if total <= 0 {
		return 0, 0
	}
	visible := m.listPageSize()
	if visible <= 0 || visible >= total {
		return 0, total
	}
	offset := m.listOffset
	maxOffset := max(0, total-visible)
	if offset > maxOffset {
		offset = maxOffset
	}
	end := offset + visible
	if end > total {
		end = total
	}
	return offset, end
}

func (m Model) listPageSize() int {
	if m.height <= 0 {
		return 10
	}
	size := m.height - 14
	if m.step == stepAppEditor {
		size = 8
	}
	if size < 4 {
		size = 4
	}
	return size
}

func (m Model) renderTableWindowStatus(total int) string {
	if total == 0 {
		return "Rows 0-0 of 0"
	}
	start, end := m.visibleRange(total)
	return fmt.Sprintf("Rows %d-%d of %d", start+1, end, total)
}

func (m Model) contentRowAt(y int, total int) (int, bool) {
	if total == 0 {
		return 0, false
	}
	rowStartY := 8
	index := m.listOffset + (y - rowStartY)
	if index < 0 || index >= total {
		return 0, false
	}
	_, end := m.visibleRange(total)
	if index >= end {
		return 0, false
	}
	return index, true
}

func (m Model) appEditorPrefixRowAt(y int) (int, bool) {
	rowStartY := 20
	index := y - rowStartY
	total := len(m.prefixSelectionIDs())
	if index < 0 || index >= total {
		return 0, false
	}
	return index, true
}

func resolvedAppURL(doc *configurator.DeploymentConfig, app configurator.DeploymentApp, ui bool) string {
	if ui {
		return configurator.ResolveDeploymentAppUIBaseURL(doc, app)
	}
	return configurator.ResolveDeploymentAppAPIBaseURL(doc, app)
}

func appHost(domain, subdomain string) string {
	base := strings.TrimSpace(domain)
	sub := strings.TrimSpace(subdomain)
	if sub == "" {
		return base
	}
	if base == "" {
		return sub
	}
	return sub + "." + base
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
