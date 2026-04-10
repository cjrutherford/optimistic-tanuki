package tui

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/cjrutherford/optimistic-tanuki/stack-client/internal/gateway"
)

type screen int

const (
	screenLogin screen = iota
	screenMenu
	screenInput
	screenOutput
)

type Action struct {
	Domain string
	Label  string
	Prompt string
	Run    func(context.Context, string) (json.RawMessage, error)
}

type clientAPI interface {
	Login(context.Context, gateway.LoginRequest) (gateway.Session, error)
}

type domainRunner interface {
	clientAPI
}

type fakeClient struct {
	loginFn  func(context.Context, gateway.LoginRequest) (gateway.Session, error)
	actionFn func(context.Context, Action, string) (json.RawMessage, error)
}

func (f fakeClient) Login(ctx context.Context, req gateway.LoginRequest) (gateway.Session, error) {
	return f.loginFn(ctx, req)
}

type loginDoneMsg struct {
	session gateway.Session
	err     error
}

type actionDoneMsg struct {
	body json.RawMessage
	err  error
}

type Model struct {
	client      clientAPI
	screen      screen
	inputs      []textinput.Model
	menu        []Action
	menuCursor  int
	current     Action
	actionInput textinput.Model
	output      string
	err         error
}

func NewModel(client clientAPI) Model {
	inputs := make([]textinput.Model, 4)
	defaults := []string{"http://localhost:3000", "", "", "owner-console"}
	prompts := []string{"Base URL: ", "Email: ", "Password: ", "App Scope: "}
	for i := range inputs {
		inputs[i] = textinput.New()
		inputs[i].Prompt = prompts[i]
		inputs[i].SetValue(defaults[i])
	}
	inputs[0].Focus()
	inputs[2].EchoMode = textinput.EchoPassword
	inputs[2].EchoCharacter = '•'

	model := Model{
		client:     client,
		screen:     screenLogin,
		inputs:     inputs,
		menu:       defaultActions(client),
		actionInput: textinput.New(),
	}
	model.actionInput.Prompt = "Value: "
	return model
}

func (m Model) Init() tea.Cmd { return textinput.Blink }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case loginDoneMsg:
		m.err = msg.err
		if msg.err == nil {
			m.screen = screenMenu
		}
		return m, nil
	case actionDoneMsg:
		m.err = msg.err
		if msg.err == nil {
			m.output = prettyJSON(msg.body)
			m.screen = screenOutput
		}
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		}
		switch m.screen {
		case screenLogin:
			return m.updateLogin(msg)
		case screenMenu:
			return m.updateMenu(msg)
		case screenInput:
			return m.updateInput(msg)
		case screenOutput:
			if msg.String() == "b" {
				m.screen = screenMenu
			}
		}
	}
	return m, nil
}

func (m Model) View() string {
	title := lipgloss.NewStyle().Bold(true).Render("Stack Client")
	if m.err != nil {
		title += "\n\nError: " + m.err.Error()
	}
	switch m.screen {
	case screenLogin:
		out := title + "\n\nLogin\n\n"
		for _, input := range m.inputs {
			out += input.View() + "\n"
		}
		return out + "\nEnter to log in"
	case screenMenu:
		return title + "\n\nMain Menu\n\n" + renderMenu(m.menu, m.menuCursor) + "\n\nEnter selects"
	case screenInput:
		return title + "\n\n" + m.current.Label + "\n\n" + m.actionInput.View() + "\n\nEnter runs"
	case screenOutput:
		return title + "\n\n" + m.current.Label + "\n\n" + m.output + "\n\nPress b to go back"
	default:
		return title
	}
}

func (m Model) updateLogin(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if msg.Type == tea.KeyEnter {
		req := gateway.LoginRequest{
			Email:    m.inputs[1].Value(),
			Password: m.inputs[2].Value(),
			AppScope: m.inputs[3].Value(),
		}
		return m, func() tea.Msg {
			session, err := m.client.Login(context.Background(), req)
			return loginDoneMsg{session: session, err: err}
		}
	}
	cmds := make([]tea.Cmd, len(m.inputs))
	for i := range m.inputs {
		m.inputs[i], cmds[i] = m.inputs[i].Update(msg)
	}
	return m, tea.Batch(cmds...)
}

func (m Model) updateMenu(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up":
		m.menuCursor = (m.menuCursor + len(m.menu) - 1) % len(m.menu)
	case "down":
		m.menuCursor = (m.menuCursor + 1) % len(m.menu)
	case "enter":
		m.current = m.menu[m.menuCursor]
		if m.current.Prompt != "" {
			m.actionInput.SetValue("")
			m.actionInput.Focus()
			m.screen = screenInput
			return m, nil
		}
		if runner, ok := m.client.(fakeClient); ok && runner.actionFn != nil {
			body, err := runner.actionFn(context.Background(), m.current, "")
			m.err = err
			if err == nil {
				m.output = prettyJSON(body)
				m.screen = screenOutput
			}
			return m, nil
		}
		return m, func() tea.Msg {
			body, err := m.current.Run(context.Background(), "")
			return actionDoneMsg{body: body, err: err}
		}
	}
	return m, nil
}

func (m Model) updateInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if msg.Type == tea.KeyEnter {
		value := m.actionInput.Value()
		return m, func() tea.Msg {
			body, err := m.current.Run(context.Background(), value)
			return actionDoneMsg{body: body, err: err}
		}
	}
	var cmd tea.Cmd
	m.actionInput, cmd = m.actionInput.Update(msg)
	return m, cmd
}

func defaultActions(client clientAPI) []Action {
	gw, _ := client.(*gateway.Client)
	if gw == nil {
		return []Action{{Domain: "app config", Label: "List app configs"}}
	}

	return []Action{
		{Domain: "app config", Label: "List app configs", Run: noArg(gw.AppConfigs)},
		{Domain: "app config", Label: "Get app config by domain", Prompt: "Domain", Run: gw.AppConfigByDomain},
		{Domain: "leads", Label: "Lead stats overview", Run: noArg(gw.LeadStats)},
		{Domain: "leads", Label: "List leads", Run: noArg(gw.Leads)},
		{Domain: "leads", Label: "List lead topics", Run: noArg(gw.LeadTopics)},
		{Domain: "communities", Label: "List communities", Run: noArg(gw.Communities)},
		{Domain: "communities", Label: "Find community by slug", Prompt: "Slug", Run: gw.CommunityBySlug},
		{Domain: "payments", Label: "Donation goal", Run: noArg(gw.DonationGoal)},
		{Domain: "payments", Label: "Transactions", Run: noArg(gw.Transactions)},
		{Domain: "classifieds", Label: "Search classifieds", Prompt: "Query", Run: gw.ClassifiedsSearch},
		{Domain: "classifieds", Label: "Get classified by id", Prompt: "Classified ID", Run: gw.ClassifiedByID},
	}
}

func noArg(fn func(context.Context) (json.RawMessage, error)) func(context.Context, string) (json.RawMessage, error) {
	return func(ctx context.Context, _ string) (json.RawMessage, error) {
		return fn(ctx)
	}
}

func renderMenu(actions []Action, cursor int) string {
	out := ""
	for i, action := range actions {
		prefix := "  "
		if i == cursor {
			prefix = "> "
		}
		out += fmt.Sprintf("%s[%s] %s\n", prefix, action.Domain, action.Label)
	}
	return out
}

func prettyJSON(raw []byte) string {
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return string(raw)
	}
	out, err := json.MarshalIndent(decoded, "", "  ")
	if err != nil {
		return string(raw)
	}
	return string(out)
}
