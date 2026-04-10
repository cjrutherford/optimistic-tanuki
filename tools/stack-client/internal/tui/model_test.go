package tui

import (
	"context"
	"encoding/json"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/cjrutherford/optimistic-tanuki/stack-client/internal/gateway"
)

func TestLoginSuccessMovesToMenu(t *testing.T) {
	model := NewModel(fakeClient{
		loginFn: func(ctx context.Context, req gateway.LoginRequest) (gateway.Session, error) {
			return gateway.Session{Token: "abc", AppScope: req.AppScope}, nil
		},
	})

	model.inputs[0].SetValue("http://localhost:3000")
	model.inputs[1].SetValue("user@example.com")
	model.inputs[2].SetValue("secret")
	model.inputs[3].SetValue("owner-console")

	updated, cmd := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("expected login command")
	}
	msg := cmd()
	updated, _ = updated.(Model).Update(msg)
	m := updated.(Model)
	if m.screen != screenMenu {
		t.Fatalf("expected menu screen, got %v", m.screen)
	}
}

func TestMenuSelectionRunsDomainAction(t *testing.T) {
	payload, _ := json.Marshal(map[string]any{"items": []string{"one"}})
	model := NewModel(fakeClient{
		loginFn: func(ctx context.Context, req gateway.LoginRequest) (gateway.Session, error) {
			return gateway.Session{Token: "abc", AppScope: req.AppScope}, nil
		},
		actionFn: func(ctx context.Context, action Action, input string) (json.RawMessage, error) {
			return payload, nil
		},
	})
	model.screen = screenMenu

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)

	if m.screen != screenOutput {
		t.Fatalf("expected output screen, got %v", m.screen)
	}
}
