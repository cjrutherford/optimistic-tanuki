package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
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
	stepReview
	stepResult
)

type generateFunc func() (configurator.GenerateResult, error)

type generateDoneMsg struct {
	result configurator.GenerateResult
	err    error
}

type option struct {
	label    string
	selected bool
}

type Model struct {
	step       step
	env        *domain.EnvironmentDefinition
	inputs     []textinput.Model
	targets    []option
	infra      []option
	services   []option
	cursor     int
	generate   generateFunc
	result     configurator.GenerateResult
	err        error
	loading    bool
}

func NewModel(env *domain.EnvironmentDefinition, generate generateFunc) Model {
	if env == nil {
		env = configurator.DefaultEnvironment()
	}
	env.Normalize()

	inputs := make([]textinput.Model, 4)
	placeholders := []string{env.Name, env.Namespace, env.ImageOwner, env.DefaultTag}
	prompts := []string{"Name: ", "Namespace: ", "Image Owner: ", "Default Tag: "}
	for i := range inputs {
		inputs[i] = textinput.New()
		inputs[i].Prompt = prompts[i]
		inputs[i].SetValue(placeholders[i])
	}
	inputs[0].Focus()

	return Model{
		step:   stepBasics,
		env:    env,
		inputs: inputs,
		targets: []option{
			{label: string(domain.TargetCompose), selected: true},
			{label: string(domain.TargetK8s), selected: true},
		},
		infra: optionsFromInfra([]domain.InfraKind{domain.InfraPostgres, domain.InfraRedis, domain.InfraSeaweedFS}, env.IncludeInfra),
		services: optionsFromServices(
			[]string{
				"gateway", "authentication", "profile", "social", "app-configurator", "system-configurator-api",
				"chat-collector", "assets", "ai-orchestration", "prompt-proxy", "telos-docs-service", "blogging",
				"permissions", "project-planning", "forum", "wellness", "classifieds", "payments", "store",
				"lead-tracker", "client-interface", "forgeofwill", "digital-homestead", "hai",
				"christopherrutherford-net", "owner-console", "store-client", "configurable-client",
				"system-configurator", "d6", "local-hub", "leads-app",
			},
			env.Services,
		),
		generate: generate,
	}
}

func (m Model) Init() tea.Cmd { return textinput.Blink }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case generateDoneMsg:
		m.loading = false
		m.result = msg.result
		m.err = msg.err
		if msg.err == nil {
			m.step = stepResult
		}
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		}

		switch m.step {
		case stepBasics:
			return m.updateBasics(msg)
		case stepTargets:
			return m.updateOptions(msg, &m.targets, stepComposeMode)
		case stepComposeMode:
			return m.updateComposeMode(msg)
		case stepInfra:
			return m.updateOptions(msg, &m.infra, stepServices)
		case stepServices:
			return m.updateOptions(msg, &m.services, stepReview)
		case stepReview:
			if msg.String() == "g" && !m.loading && m.generate != nil {
				m.loading = true
				m.syncEnv()
				return m, func() tea.Msg {
					result, err := m.generate()
					return generateDoneMsg{result: result, err: err}
				}
			}
			if msg.String() == "b" {
				m.step = stepServices
			}
		case stepResult:
			if msg.String() == "r" {
				m.step = stepBasics
			}
		}
	}
	return m, nil
}

func (m Model) View() string {
	title := lipgloss.NewStyle().Bold(true).Render("Admin Env Wizard")
	switch m.step {
	case stepBasics:
		lines := []string{title, "", "Environment Basics", ""}
		for _, input := range m.inputs {
			lines = append(lines, input.View())
		}
		lines = append(lines, "", "Enter to continue")
		return strings.Join(lines, "\n")
	case stepTargets:
		return title + "\n\nSelect targets\n\n" + renderOptions(m.targets, m.cursor) + "\n\nSpace toggles, Enter continues"
	case stepComposeMode:
		mode := string(m.env.ComposeMode)
		if mode == "" {
			mode = string(domain.ComposeModeImage)
		}
		return fmt.Sprintf("%s\n\nCompose Mode\n\nCurrent: %s\n\nPress b for build, i for image, Enter continues", title, mode)
	case stepInfra:
		return title + "\n\nSelect infra\n\n" + renderOptions(m.infra, m.cursor) + "\n\nSpace toggles, Enter continues"
	case stepServices:
		return title + "\n\nSelect services\n\n" + renderOptions(m.services, m.cursor) + "\n\nSpace toggles, Enter continues"
	case stepReview:
		return title + "\n\nReview\n\n" + m.reviewSummary() + "\n\nPress g to generate or b to go back"
	case stepResult:
		if m.err != nil {
			return title + "\n\nGeneration failed:\n" + m.err.Error()
		}
		return fmt.Sprintf("%s\n\nGenerated output in %s\nCompose: %s\nK8s: %s\n\nPress q to quit", title, m.result.OutputDir, m.result.ComposePath, m.result.K8sPath)
	default:
		return title
	}
}

func (m Model) updateBasics(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEnter:
		m.env.Name = m.inputs[0].Value()
		m.env.Namespace = m.inputs[1].Value()
		m.env.ImageOwner = m.inputs[2].Value()
		m.env.DefaultTag = m.inputs[3].Value()
		m.cursor = 0
		m.step = stepTargets
		return m, nil
	case tea.KeyTab, tea.KeyShiftTab, tea.KeyUp, tea.KeyDown:
		if msg.Type == tea.KeyUp || msg.Type == tea.KeyShiftTab {
			m.cursor = (m.cursor + len(m.inputs) - 1) % len(m.inputs)
		} else {
			m.cursor = (m.cursor + 1) % len(m.inputs)
		}
		for i := range m.inputs {
			if i == m.cursor {
				m.inputs[i].Focus()
			} else {
				m.inputs[i].Blur()
			}
		}
		return m, nil
	}

	cmds := make([]tea.Cmd, len(m.inputs))
	for i := range m.inputs {
		m.inputs[i], cmds[i] = m.inputs[i].Update(msg)
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
	case "enter":
		m.cursor = 0
		m.step = next
	}
	return m, nil
}

func (m Model) updateComposeMode(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "b":
		m.env.ComposeMode = domain.ComposeModeBuild
	case "i":
		m.env.ComposeMode = domain.ComposeModeImage
	case "enter":
		m.step = stepInfra
	}
	return m, nil
}

func (m *Model) syncEnv() {
	m.env.Targets = nil
	for _, opt := range m.targets {
		if opt.selected {
			m.env.Targets = append(m.env.Targets, domain.Target(opt.label))
		}
	}
	m.env.IncludeInfra = nil
	for _, opt := range m.infra {
		if opt.selected {
			m.env.IncludeInfra = append(m.env.IncludeInfra, domain.InfraKind(opt.label))
		}
	}
	m.env.Services = nil
	for _, opt := range m.services {
		if opt.selected {
			m.env.Services = append(m.env.Services, domain.ServiceSelection{ServiceID: opt.label, Enabled: true})
		}
	}
}

func (m Model) reviewSummary() string {
	var targets []string
	for _, opt := range m.targets {
		if opt.selected {
			targets = append(targets, opt.label)
		}
	}
	var infra []string
	for _, opt := range m.infra {
		if opt.selected {
			infra = append(infra, opt.label)
		}
	}
	var services []string
	for _, opt := range m.services {
		if opt.selected {
			services = append(services, opt.label)
		}
	}
	return fmt.Sprintf(
		"Name: %s\nNamespace: %s\nImage Owner: %s\nDefault Tag: %s\nTargets: %s\nCompose Mode: %s\nInfra: %s\nServices: %d selected",
		m.inputs[0].Value(),
		m.inputs[1].Value(),
		m.inputs[2].Value(),
		m.inputs[3].Value(),
		strings.Join(targets, ", "),
		m.env.ComposeMode,
		strings.Join(infra, ", "),
		len(services),
	)
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
